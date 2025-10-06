#!/usr/bin/env bash
set -Eeuo pipefail

CONFIG_PATH=${1:-}
if [ -z "$CONFIG_PATH" ]; then
  echo "[cmux] missing remote plan config path" >&2
  exit 1
fi

if [ ! -f "$CONFIG_PATH" ]; then
  echo "[cmux] remote plan config not found: $CONFIG_PATH" >&2
  exit 1
fi

# shellcheck disable=SC1090
. "$CONFIG_PATH"

if [ -z "${ENSURE_DOCKER_SCRIPT_PATH:-}" ]; then
  echo "[cmux] remote plan config missing docker ensure script path" >&2
  exit 1
fi

TIMINGS_FILE=$(mktemp)
cleanup_tmp() {
  rm -f "$TIMINGS_FILE"
}
trap cleanup_tmp EXIT

LOG_FILE=${PLAN_LOG_PATH:-/opt/app/cmux-build.log}
mkdir -p "$(dirname "$LOG_FILE")"
: > "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1

log() {
  printf '[cmux] %s\n' "$*"
}

record_timing() {
  printf '%s %s\n' "$1" "$2" >> "$TIMINGS_FILE"
}

run_step() {
  local label="$1"
  shift
  local func="$1"
  shift

  log ">>> ${label}"
  local start end duration status
  start=$(date +%s.%N)
  set +e
  "$func" "$@"
  status=$?
  set -e
  end=$(date +%s.%N)

  if [ "$status" -ne 0 ]; then
    log "!!! ${label} failed with exit code ${status}"
    return "$status"
  fi

  duration=$(awk -v start="$start" -v end="$end" 'BEGIN { printf "%.6f", end - start }')
  record_timing "$label" "$duration"
  log "<<< ${label} ${duration}s"
}

step_ensure_tooling() {
  DEBIAN_FRONTEND=noninteractive apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates curl gnupg lsb-release apt-transport-https \
    procps util-linux coreutils tar python3
  rm -rf /var/lib/apt/lists/*
  mkdir -p /opt/app/rootfs /opt/app/workdir
  if ! bash "$ENSURE_DOCKER_SCRIPT_PATH"; then
    log "ensure docker script failed" >&2
    return 1
  fi
  if [ -n "${ENSURE_DOCKER_CLI_SCRIPT_PATH:-}" ] && [ -f "$ENSURE_DOCKER_CLI_SCRIPT_PATH" ]; then
    if ! bash "$ENSURE_DOCKER_CLI_SCRIPT_PATH"; then
      log "ensure docker cli script failed" >&2
      return 1
    fi
  fi
  if [ -x /usr/bin/docker ]; then
    log "docker binary present at /usr/bin/docker"
  fi
  if ! ls -l /usr/bin/docker >/dev/null 2>&1; then
    log "docker binary not found in /usr/bin" >&2
  fi
  if ! command -v docker >/dev/null 2>&1; then
    log "docker binary missing after ensure script" >&2
    return 1
  fi
}

step_extract_repo_archive() {
  mkdir -p "$REMOTE_REPO_ROOT"
  tar -xzf "$REMOTE_ARCHIVE_PATH" -C "$REMOTE_REPO_ROOT"
  rm -f "$REMOTE_ARCHIVE_PATH"
}

step_remote_build_image() {
  rm -f "$BUILD_LOG_PATH"
  mkdir -p "$(dirname "$BUILD_LOG_PATH")"
  cd "$REMOTE_CONTEXT_DIR"
  local build_args
  build_args=(--progress=plain --platform "$PLATFORM" -t "$BUILT_IMAGE" -f "$REMOTE_DOCKERFILE_PATH" --load)
  if [ -n "$DOCKER_BUILD_TARGET" ]; then
    build_args+=(--target "$DOCKER_BUILD_TARGET")
  fi
  build_args+=(.)
  docker buildx build "${build_args[@]}" |& tee "$BUILD_LOG_PATH"
}

step_remote_pull_image() {
  docker pull --platform "$PLATFORM" "$SOURCE_IMAGE"
}

step_inspect_image() {
  local tmp_json
  tmp_json=$(mktemp)
  docker image inspect "$BUILT_IMAGE" > "$tmp_json"
  python3 - <<'PY' "$tmp_json" "$IMAGE_CONFIG_OUTPUT_PATH"
import json
import sys

src, dest = sys.argv[1:3]
with open(src, "r", encoding="utf-8") as src_file:
    data = json.load(src_file)
if not data:
    raise SystemExit("docker image inspect returned no data")
config = data[0].get("Config") or {}
result = {
    "entrypoint": config.get("Entrypoint") or [],
    "cmd": config.get("Cmd") or [],
    "env": config.get("Env") or [],
    "workdir": config.get("WorkingDir") or "/",
    "user": config.get("User") or "root",
}
with open(dest, "w", encoding="utf-8") as dest_file:
    json.dump(result, dest_file)
PY
  rm -f "$tmp_json"
}

step_export_rootfs() {
  local cid
  cid=$(docker create --platform "$PLATFORM" "$BUILT_IMAGE")
  cleanup() {
    docker rm -f "$cid" >/dev/null 2>&1 || true
  }
  trap cleanup RETURN
  docker export "$cid" -o "$ROOTFS_TAR_PATH"
  cleanup
  trap - RETURN
}

step_extract_rootfs() {
  tar -xf "$ROOTFS_TAR_PATH" -C /opt/app/rootfs
  rm -f "$ROOTFS_TAR_PATH"
}

step_sync_resolv_conf() {
  local dest=/opt/app/rootfs/etc/resolv.conf
  mkdir -p /opt/app/rootfs/etc
  rm -f "$dest"

  local source_resolv=""
  if [ -f /run/systemd/resolve/resolv.conf ]; then
    source_resolv=/run/systemd/resolve/resolv.conf
  elif [ -f /etc/resolv.conf ]; then
    source_resolv=/etc/resolv.conf
  fi

  if [ -n "$source_resolv" ]; then
    cp -L "$source_resolv" "$dest"
    sed -i '/^[[:space:]]*nameserver[[:space:]]*127\\./d' "$dest" || true
    sed -i '/^[[:space:]]*nameserver[[:space:]]*::1/d' "$dest" || true
  fi

  if ! grep -Eq '^[[:space:]]*nameserver[[:space:]]+' "$dest" 2>/dev/null; then
    cat <<'EOF_RESOLV' >"$dest"
nameserver 1.1.1.1
nameserver 1.0.0.1
nameserver 2606:4700:4700::1111
nameserver 2606:4700:4700::1001
EOF_RESOLV
  fi

  chmod 0644 "$dest"
}

step_prepare_workspace() {
  local workspace_dir=/opt/app/rootfs/root/workspace
  mkdir -p "$workspace_dir"
  find "$workspace_dir" -mindepth 1 -maxdepth 1 -exec rm -rf '{}' +
  ls -A "$workspace_dir" | head -n 5 || true
}

step_cleanup_build_workspace() {
  rm -rf "$REMOTE_REPO_ROOT"
}

step_cleanup_docker() {
  docker image rm "$BUILT_IMAGE" >/dev/null 2>&1 || true
  docker builder prune -af >/dev/null 2>&1 || true
  docker system prune -af >/dev/null 2>&1 || true
}

step_prepare_overlay() {
  mkdir -p /opt/app/runtime /opt/app/overlay/upper /opt/app/overlay/work
}

step_write_env_file() {
  python3 - <<'PY' "$IMAGE_CONFIG_OUTPUT_PATH" "$ENV_FILE_PATH"
import json
import sys
from pathlib import Path

config_path, env_path = sys.argv[1:3]
with open(config_path, "r", encoding="utf-8") as config_file:
    config = json.load(config_file)

lines = list(config.get("env") or [])
lines.extend([
    "CMUX_ROOTFS=/opt/app/rootfs",
    "CMUX_RUNTIME_ROOT=/opt/app/runtime",
    "CMUX_OVERLAY_UPPER=/opt/app/overlay/upper",
    "CMUX_OVERLAY_WORK=/opt/app/overlay/work",
])

env_destination = Path(env_path)
env_destination.parent.mkdir(parents=True, exist_ok=True)
with open(env_destination, "w", encoding="utf-8") as env_file:
    for line in lines:
        env_file.write(f"{line}\n")
PY
}

step_enable_cmux_units() {
  local units=(
    cmux.target
    cmux-openvscode.service
    cmux-worker.service
    cmux-dockerd.service
    cmux-vnc.service
  )

  for unit in "${units[@]}"; do
    local src="/opt/app/rootfs/usr/lib/systemd/system/$unit"
    local dest="/etc/systemd/system/$unit"
    if [ -f "$src" ]; then
      cp "$src" "$dest"
    fi
  done

  mkdir -p /usr/local/lib/cmux
  if [ -d /opt/app/rootfs/usr/local/lib/cmux ]; then
    cp -a /opt/app/rootfs/usr/local/lib/cmux/. /usr/local/lib/cmux/
  fi

  for tool in cmux-rootfs-exec configure-openvscode cmux-start-vnc; do
    local path="/usr/local/lib/cmux/$tool"
    if [ -f "$path" ]; then
      chmod +x "$path"
    fi
  done

  mkdir -p /var/log/cmux
  systemctl daemon-reload
  systemctl enable cmux.target
}

step_sanity_checks() {
  set -euo pipefail

  if [ ! -f /opt/app/app.env ]; then
    echo "cmux sanity: missing /opt/app/app.env" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1091
  . /opt/app/app.env
  set +a

  run_chroot() {
    CMUX_ROOTFS="$CMUX_ROOTFS" \\
    CMUX_RUNTIME_ROOT="$CMUX_RUNTIME_ROOT" \\
    CMUX_OVERLAY_UPPER="${CMUX_OVERLAY_UPPER:-}" \\
    CMUX_OVERLAY_WORK="${CMUX_OVERLAY_WORK:-}" \\
    /usr/local/lib/cmux/cmux-rootfs-exec "$@"
  }

  local log_dir=/tmp/cmux-sanity
  rm -rf "$log_dir"
  mkdir -p "$log_dir"
  export CMUX_DEBUG=1

  forkpty_check() {
    local log="$log_dir/forkpty.log"
    if run_chroot /bin/bash >"$log" 2>&1 <<'BASH'
set -euo pipefail
if command -v script >/dev/null 2>&1; then
    if script -qfec "echo forkpty-ok" /dev/null >/dev/null; then
        exit 0
    fi
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 not available for forkpty fallback" >&2
    exit 1
fi

python3 - <<'PY'
import os
import pty
import sys

pid, fd = pty.fork()
if pid == 0:
    os.execlp("sh", "sh", "-c", "echo forkpty-python")

data = os.read(fd, 1024)
if b"forkpty-python" not in data:
    raise SystemExit("forkpty output missing")
PY
BASH
    then
      echo "[sanity] forkpty ok"
    else
      echo "[sanity] forkpty failed" >&2
      cat "$log" >&2 || true
      return 1
    fi
  }

  docker_check() {
    local log="$log_dir/docker.log"
    if run_chroot /bin/bash >"$log" 2>&1 <<'BASH'
set -euo pipefail
docker run --pull=missing --rm hello-world >/dev/null
docker image rm hello-world >/dev/null 2>&1 || true
BASH
    then
      echo "[sanity] docker run ok"
    else
      echo "[sanity] docker run failed" >&2
      cat "$log" >&2 || true
      return 1
    fi
  }

  envctl_check() {
    local log="$log_dir/envctl.log"
    if run_chroot /bin/bash >"$log" 2>&1 <<'BASH'
set -euo pipefail
var_name=MY_ENV_VAR_SANITY
var_value=envctl-ok

envctl set "${var_name}=${var_value}"
actual=$(envctl get "${var_name}" || true)
if [[ "${actual}" != "${var_value}" ]]; then
    echo "expected ${var_value}, got '${actual}'" >&2
    exit 1
fi

envctl unset "${var_name}"
if envctl get "${var_name}" | grep -q .; then
    echo "envctl value persisted after unset" >&2
    exit 1
fi
BASH
    then
      echo "[sanity] envctl propagation ok"
    else
      echo "[sanity] envctl propagation failed" >&2
      cat "$log" >&2 || true
      return 1
    fi
  }

  forkpty_check
  docker_check
  envctl_check

  rm -rf "$log_dir"
  echo "[sanity] all checks passed"
}

finalize_results() {
  python3 - <<'PY' "$TIMINGS_FILE" "$IMAGE_CONFIG_OUTPUT_PATH" "$RESULT_PATH"
import json
import sys
from pathlib import Path

timings_path, config_path, result_path = sys.argv[1:4]

entries: dict[str, float] = {}
with open(timings_path, "r", encoding="utf-8") as handle:
    for line in handle:
        data = line.strip()
        if not data:
            continue
        label, value = data.split(" ", 1)
        entries[label] = float(value)

with open(config_path, "r", encoding="utf-8") as config_file:
    config = json.load(config_file)

Path(result_path).parent.mkdir(parents=True, exist_ok=True)
with open(result_path, "w", encoding="utf-8") as result_file:
    json.dump({"timings": entries, "image_config": config}, result_file)
PY
}

main() {
  if ! run_step "build_snapshot:ensure_tooling" step_ensure_tooling; then return 1; fi

  if [ "$MODE" = "build" ]; then
    if ! run_step "build_snapshot:extract_repo_archive" step_extract_repo_archive; then return 1; fi
    if ! run_step "build_snapshot:remote_build_image" step_remote_build_image; then return 1; fi
  else
    if ! run_step "build_snapshot:remote_pull_image" step_remote_pull_image; then return 1; fi
  fi

  if ! run_step "build_snapshot:inspect_image" step_inspect_image; then return 1; fi
  if ! run_step "build_snapshot:export_rootfs" step_export_rootfs; then return 1; fi
  if ! run_step "build_snapshot:extract_rootfs" step_extract_rootfs; then return 1; fi
  if ! run_step "build_snapshot:sync_resolv_conf" step_sync_resolv_conf; then return 1; fi
  if ! run_step "build_snapshot:prepare_workspace" step_prepare_workspace; then return 1; fi

  if [ "$MODE" = "build" ]; then
    if ! run_step "build_snapshot:cleanup_build_workspace" step_cleanup_build_workspace; then return 1; fi
  fi

  if ! run_step "build_snapshot:cleanup_docker" step_cleanup_docker; then return 1; fi
  if ! run_step "build_snapshot:prepare_overlay" step_prepare_overlay; then return 1; fi
  if ! run_step "build_snapshot:write_env_file" step_write_env_file; then return 1; fi
  if ! run_step "build_snapshot:enable_cmux_units" step_enable_cmux_units; then return 1; fi
  if ! run_step "build_snapshot:sanity_checks" step_sanity_checks; then return 1; fi

  finalize_results
}

main "$@"
