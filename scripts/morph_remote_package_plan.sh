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

LOG_FILE=${PLAN_LOG_PATH:-/opt/app/cmux-packaging.log}
mkdir -p "$(dirname "$LOG_FILE")"
: > "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1

log() {
  printf '[cmux] %s\n' "$*"
}

wait_for_apt_locks() {
  local locks=(
    /var/lib/dpkg/lock-frontend
    /var/lib/dpkg/lock
    /var/lib/apt/lists/lock
    /var/cache/apt/archives/lock
  )
  local waited=0
  while true; do
    local busy=0
    for lock in "${locks[@]}"; do
      if [ -e "$lock" ] && command -v fuser >/dev/null 2>&1 && fuser "$lock" >/dev/null 2>&1; then
        busy=1
        break
      fi
    done
    if [ "$busy" -eq 0 ]; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
    if [ "$waited" -ge 120 ]; then
      log "timed out waiting for apt locks"
      return 1
    fi
  done
}

apt_run() {
  wait_for_apt_locks || return 1
  env DEBIAN_FRONTEND=noninteractive apt-get "$@"
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
  apt_run update
  apt_run install -y \
    ca-certificates curl gnupg lsb-release apt-transport-https \
    procps util-linux coreutils tar python3
  rm -rf /var/lib/apt/lists/*

  wait_for_apt_locks || return 1
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
}

step_extract_repo_archive() {
  if [ -z "${REMOTE_ARCHIVE_PATH:-}" ] || [ ! -f "$REMOTE_ARCHIVE_PATH" ]; then
    log "remote archive path missing: $REMOTE_ARCHIVE_PATH" >&2
    return 1
  fi

  mkdir -p "$REMOTE_REPO_ROOT"
  tar -xzf "$REMOTE_ARCHIVE_PATH" -C "$REMOTE_REPO_ROOT"
  rm -f "$REMOTE_ARCHIVE_PATH"
}

step_remote_build_packages() {
  local build_log="${BUILD_LOG_PATH:-/opt/app/docker-build.log}"
  mkdir -p "$(dirname "$build_log")"
  rm -f "$build_log"

  local output_dir="${PACKAGE_OUTPUT_DIR:-/opt/app/out}"
  rm -rf "$output_dir"
  mkdir -p "$output_dir"

  cd "$REMOTE_CONTEXT_DIR"

  local build_args
  build_args=(--progress=plain --platform "$PLATFORM" -f "$REMOTE_DOCKERFILE_PATH" --target "$DOCKER_BUILD_TARGET" --output "type=local,dest=${output_dir}")
  build_args+=(.)

  docker buildx build "${build_args[@]}" |& tee "$build_log"
}

step_archive_packages() {
  local output_dir="${PACKAGE_OUTPUT_DIR:-/opt/app/out}"
  local archive="${PACKAGE_ARCHIVE_PATH:-/opt/app/packages.tar.gz}"

  if [ ! -d "$output_dir" ]; then
    log "package output directory missing: $output_dir" >&2
    return 1
  fi

  rm -f "$archive"
  tar -czf "$archive" -C "$output_dir" .
}

step_write_result() {
  local archive="${PACKAGE_ARCHIVE_PATH:-/opt/app/packages.tar.gz}"
  local result="${RESULT_PATH:-/opt/app/cmux-package-result.json}"
  local output_dir="${PACKAGE_OUTPUT_DIR:-/opt/app/out}"

  if [ ! -f "$archive" ]; then
    log "package archive missing: $archive" >&2
    return 1
  fi

  mkdir -p "$(dirname "$result")"

  python3 - <<'PY' "$TIMINGS_FILE" "$archive" "$output_dir" "$result"
import json
import sys
from pathlib import Path

timings_path, archive_path, output_dir, result_path = sys.argv[1:5]

timings: dict[str, float] = {}
timings_file = Path(timings_path)
if timings_file.exists():
    for line in timings_file.read_text(encoding="utf-8").splitlines():
        label, _, value = line.partition(" ")
        if not label or not value:
            continue
        try:
            timings[label] = float(value)
        except ValueError:
            continue

files = []
out_dir = Path(output_dir)
if out_dir.exists():
    files = sorted(str(path.relative_to(out_dir)) for path in out_dir.rglob("*") if path.is_file())

payload = {
    "timings": timings,
    "archive_path": archive_path,
    "package_files": files,
}
Path(result_path).write_text(json.dumps(payload), encoding="utf-8")
PY
}

main() {
  run_step "ensure_tooling" step_ensure_tooling
  run_step "extract_repo_archive" step_extract_repo_archive
  run_step "docker_package_build" step_remote_build_packages
  run_step "archive_packages" step_archive_packages
  run_step "write_result" step_write_result
}

main
