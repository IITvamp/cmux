#!/usr/bin/env bash
set -euo pipefail

log() {
    printf '[cmux remote] %s\n' "$*" >&2
}

usage() {
    cat >&2 <<'USAGE'
Usage: morph_remote_snapshot_remote.sh [options]
  --mode <build|pull>
  --platform <platform>
  --remote-archive <path>
  --remote-repo-root <path>
  --remote-context <path>
  --remote-dockerfile <path>
  --build-log <path>
  --build-tag <name>
  --build-target <target>
  --image-name <name>
  --inspect-path <path>
  --summary-path <path>
  --app-env-path <path>
  --rootfs-dir <path>
  --workdir-base <path>
  --workspace-dir <path>
  --runtime-root <path>
  --overlay-upper <path>
  --overlay-work <path>
  --rootfs-tar <path>
USAGE
}

MODE=""
PLATFORM=""
REMOTE_ARCHIVE=""
REMOTE_REPO_ROOT=""
REMOTE_CONTEXT=""
REMOTE_DOCKERFILE=""
BUILD_LOG=""
BUILD_TAG=""
BUILD_TARGET=""
IMAGE_NAME=""
INSPECT_PATH=""
SUMMARY_PATH=""
APP_ENV_PATH="/opt/app/app.env"
ROOTFS_DIR="/opt/app/rootfs"
WORKDIR_BASE="/opt/app/workdir"
WORKSPACE_DIR="/opt/app/rootfs/root/workspace"
RUNTIME_ROOT="/opt/app/runtime"
OVERLAY_UPPER="/opt/app/overlay/upper"
OVERLAY_WORK="/opt/app/overlay/work"
ROOTFS_TAR="/opt/app/rootfs.tar"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode)
            MODE="$2"
            shift 2
            ;;
        --mode=*)
            MODE="${1#*=}"
            shift
            ;;
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --platform=*)
            PLATFORM="${1#*=}"
            shift
            ;;
        --remote-archive)
            REMOTE_ARCHIVE="$2"
            shift 2
            ;;
        --remote-archive=*)
            REMOTE_ARCHIVE="${1#*=}"
            shift
            ;;
        --remote-repo-root)
            REMOTE_REPO_ROOT="$2"
            shift 2
            ;;
        --remote-repo-root=*)
            REMOTE_REPO_ROOT="${1#*=}"
            shift
            ;;
        --remote-context)
            REMOTE_CONTEXT="$2"
            shift 2
            ;;
        --remote-context=*)
            REMOTE_CONTEXT="${1#*=}"
            shift
            ;;
        --remote-dockerfile)
            REMOTE_DOCKERFILE="$2"
            shift 2
            ;;
        --remote-dockerfile=*)
            REMOTE_DOCKERFILE="${1#*=}"
            shift
            ;;
        --build-log)
            BUILD_LOG="$2"
            shift 2
            ;;
        --build-log=*)
            BUILD_LOG="${1#*=}"
            shift
            ;;
        --build-tag)
            BUILD_TAG="$2"
            shift 2
            ;;
        --build-tag=*)
            BUILD_TAG="${1#*=}"
            shift
            ;;
        --build-target)
            BUILD_TARGET="$2"
            shift 2
            ;;
        --build-target=*)
            BUILD_TARGET="${1#*=}"
            shift
            ;;
        --image-name)
            IMAGE_NAME="$2"
            shift 2
            ;;
        --image-name=*)
            IMAGE_NAME="${1#*=}"
            shift
            ;;
        --inspect-path)
            INSPECT_PATH="$2"
            shift 2
            ;;
        --inspect-path=*)
            INSPECT_PATH="${1#*=}"
            shift
            ;;
        --summary-path)
            SUMMARY_PATH="$2"
            shift 2
            ;;
        --summary-path=*)
            SUMMARY_PATH="${1#*=}"
            shift
            ;;
        --app-env-path)
            APP_ENV_PATH="$2"
            shift 2
            ;;
        --app-env-path=*)
            APP_ENV_PATH="${1#*=}"
            shift
            ;;
        --rootfs-dir)
            ROOTFS_DIR="$2"
            shift 2
            ;;
        --rootfs-dir=*)
            ROOTFS_DIR="${1#*=}"
            shift
            ;;
        --workdir-base)
            WORKDIR_BASE="$2"
            shift 2
            ;;
        --workdir-base=*)
            WORKDIR_BASE="${1#*=}"
            shift
            ;;
        --workspace-dir)
            WORKSPACE_DIR="$2"
            shift 2
            ;;
        --workspace-dir=*)
            WORKSPACE_DIR="${1#*=}"
            shift
            ;;
        --runtime-root)
            RUNTIME_ROOT="$2"
            shift 2
            ;;
        --runtime-root=*)
            RUNTIME_ROOT="${1#*=}"
            shift
            ;;
        --overlay-upper)
            OVERLAY_UPPER="$2"
            shift 2
            ;;
        --overlay-upper=*)
            OVERLAY_UPPER="${1#*=}"
            shift
            ;;
        --overlay-work)
            OVERLAY_WORK="$2"
            shift 2
            ;;
        --overlay-work=*)
            OVERLAY_WORK="${1#*=}"
            shift
            ;;
        --rootfs-tar)
            ROOTFS_TAR="$2"
            shift 2
            ;;
        --rootfs-tar=*)
            ROOTFS_TAR="${1#*=}"
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            log "Unknown argument: $1"
            usage
            exit 1
            ;;
    esac
done

if [[ -z "$MODE" ]]; then
    log "Missing required --mode"
    exit 1
fi
if [[ -z "$PLATFORM" ]]; then
    log "Missing required --platform"
    exit 1
fi
if [[ -z "$INSPECT_PATH" ]]; then
    log "Missing required --inspect-path"
    exit 1
fi
if [[ -z "$SUMMARY_PATH" ]]; then
    log "Missing required --summary-path"
    exit 1
fi

if [[ "$MODE" == "build" ]]; then
    if [[ -z "$REMOTE_ARCHIVE" || -z "$REMOTE_REPO_ROOT" || -z "$REMOTE_CONTEXT" || -z "$REMOTE_DOCKERFILE" || -z "$BUILD_LOG" || -z "$BUILD_TAG" ]]; then
        log "Missing required build arguments"
        exit 1
    fi
elif [[ "$MODE" == "pull" ]]; then
    if [[ -z "$IMAGE_NAME" ]]; then
        log "Missing required --image-name for pull mode"
        exit 1
    fi
else
    log "Unsupported mode: $MODE"
    exit 1
fi

TIMINGS_FILE=$(mktemp)
CONFIG_JSON_FILE=$(mktemp)
trap 'rm -f "$TIMINGS_FILE" "$CONFIG_JSON_FILE"' EXIT

format_duration() {
    local start_ns="$1"
    local end_ns="$2"
    local diff_ns=$((end_ns - start_ns))
    if (( diff_ns < 0 )); then
        diff_ns=0
    fi
    local duration_ms=$((diff_ns / 1000000))
    local seconds=$((duration_ms / 1000))
    local millis=$((duration_ms % 1000))
    printf '%d.%03d' "$seconds" "$millis"
}

record_timing() {
    local label="$1"
    local start_ns="$2"
    local end_ns="$3"
    local duration
    duration=$(format_duration "$start_ns" "$end_ns")
    printf '%s|%s\n' "$label" "$duration" >> "$TIMINGS_FILE"
    echo "$duration"
}

run_step() {
    local label="$1"
    shift
    log "Starting ${label}"
    local start_ns end_ns duration
    start_ns=$(date +%s%N)
    if "$@"; then
        end_ns=$(date +%s%N)
        duration=$(record_timing "$label" "$start_ns" "$end_ns")
        log "Completed ${label} in ${duration}s"
        return 0
    else
        end_ns=$(date +%s%N)
        duration=$(record_timing "$label" "$start_ns" "$end_ns")
        log "ERROR: ${label} failed after ${duration}s"
        return 1
    fi
}

prepare_directories() {
    mkdir -p "$ROOTFS_DIR" "$WORKDIR_BASE" "$RUNTIME_ROOT" "$OVERLAY_UPPER" "$OVERLAY_WORK"
}

extract_repo_archive() {
    if [[ -z "$REMOTE_ARCHIVE" || -z "$REMOTE_REPO_ROOT" ]]; then
        return 0
    fi
    mkdir -p "$REMOTE_REPO_ROOT"
    if [[ ! -f "$REMOTE_ARCHIVE" ]]; then
        log "Archive $REMOTE_ARCHIVE not found"
        return 1
    fi
    tar -xzf "$REMOTE_ARCHIVE" -C "$REMOTE_REPO_ROOT"
    rm -f "$REMOTE_ARCHIVE"
}

build_image() {
    if [[ "$MODE" != "build" ]]; then
        return 0
    fi
    if [[ -z "$REMOTE_CONTEXT" || -z "$REMOTE_DOCKERFILE" || -z "$BUILD_LOG" || -z "$BUILD_TAG" ]]; then
        log "Build parameters not fully specified"
        return 1
    fi
    if [[ ! -d "$REMOTE_CONTEXT" ]]; then
        log "Build context $REMOTE_CONTEXT missing"
        return 1
    fi
    rm -f "$BUILD_LOG"
    pushd "$REMOTE_CONTEXT" >/dev/null
    local cmd=(docker buildx build --progress=plain --platform "$PLATFORM" -t "$BUILD_TAG" -f "$REMOTE_DOCKERFILE" --load .)
    if [[ -n "$BUILD_TARGET" ]]; then
        cmd=(docker buildx build --progress=plain --platform "$PLATFORM" -t "$BUILD_TAG" -f "$REMOTE_DOCKERFILE" --load --target "$BUILD_TARGET" .)
    fi
    "${cmd[@]}" |& tee "$BUILD_LOG"
    popd >/dev/null
}

pull_image() {
    if [[ "$MODE" != "pull" ]]; then
        return 0
    fi
    docker pull --platform "$PLATFORM" "$IMAGE_NAME"
}

inspect_image() {
    docker image inspect "$BUILT_IMAGE" > "$INSPECT_PATH"
}

export_rootfs() {
    local cid
    cid=$(docker create --platform "$PLATFORM" "$BUILT_IMAGE")
    cleanup() {
        docker rm -f "$cid" >/dev/null 2>&1 || true
    }
    trap cleanup EXIT
    docker export "$cid" -o "$ROOTFS_TAR"
    cleanup
    trap - EXIT
}

extract_rootfs() {
    mkdir -p "$ROOTFS_DIR"
    if [[ -d "$ROOTFS_DIR" ]]; then
        find "$ROOTFS_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    fi
    tar -xf "$ROOTFS_TAR" -C "$ROOTFS_DIR"
    rm -f "$ROOTFS_TAR"
}

sync_resolv_conf() {
    local dest="$ROOTFS_DIR/etc/resolv.conf"
    mkdir -p "$ROOTFS_DIR/etc"
    rm -f "$dest"
    local source_resolv=""
    if [[ -f /run/systemd/resolve/resolv.conf ]]; then
        source_resolv=/run/systemd/resolve/resolv.conf
    elif [[ -f /etc/resolv.conf ]]; then
        source_resolv=/etc/resolv.conf
    fi
    if [[ -n "$source_resolv" ]]; then
        cp -L "$source_resolv" "$dest"
        sed -i '/^[[:space:]]*nameserver[[:space:]]*127\./d' "$dest" || true
        sed -i '/^[[:space:]]*nameserver[[:space:]]*::1/d' "$dest" || true
    fi
    if ! grep -Eq '^[[:space:]]*nameserver[[:space:]]+' "$dest" 2>/dev/null; then
        cat <<'DNS' >"$dest"
nameserver 1.1.1.1
nameserver 1.0.0.1
nameserver 2606:4700:4700::1111
nameserver 2606:4700:4700::1001
DNS
    fi
    chmod 0644 "$dest"
}

prepare_workspace() {
    mkdir -p "$WORKSPACE_DIR"
    find "$WORKSPACE_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    ls -A "$WORKSPACE_DIR" | head -n 5 || true
}

cleanup_build_workspace() {
    if [[ -n "$REMOTE_REPO_ROOT" ]]; then
        rm -rf "$REMOTE_REPO_ROOT"
    fi
}

cleanup_docker() {
    docker image rm "$BUILT_IMAGE" >/dev/null 2>&1 || true
    docker builder prune -af >/dev/null 2>&1 || true
    docker system prune -af >/dev/null 2>&1 || true
}

prepare_overlay() {
    mkdir -p "$RUNTIME_ROOT" "$OVERLAY_UPPER" "$OVERLAY_WORK"
}

write_env_file() {
    local output
    output=$(python3 - "$INSPECT_PATH" "$APP_ENV_PATH" "$ROOTFS_DIR" "$RUNTIME_ROOT" "$OVERLAY_UPPER" "$OVERLAY_WORK" <<'PY'
import json
import sys
from pathlib import Path

inspect_path = Path(sys.argv[1])
app_env_path = Path(sys.argv[2])
rootfs_dir = Path(sys.argv[3])
runtime_root = Path(sys.argv[4])
overlay_upper = Path(sys.argv[5])
overlay_work = Path(sys.argv[6])

data = json.loads(inspect_path.read_text())
if not data:
    raise SystemExit("docker image inspect returned no data")
config = data[0].get("Config") or {}
entrypoint = config.get("Entrypoint") or []
cmd = config.get("Cmd") or []
env = config.get("Env") or []
workdir = config.get("WorkingDir") or "/"
user = config.get("User") or "root"

env_lines = list(env)
extra_lines = [
    f"CMUX_ROOTFS={rootfs_dir}",
    f"CMUX_RUNTIME_ROOT={runtime_root}",
    f"CMUX_OVERLAY_UPPER={overlay_upper}",
    f"CMUX_OVERLAY_WORK={overlay_work}",
]
for line in extra_lines:
    if line not in env_lines:
        env_lines.append(line)
app_env_path.write_text("\n".join(env_lines) + "\n")
print(json.dumps({
    "entrypoint": entrypoint,
    "cmd": cmd,
    "env": env,
    "workdir": workdir or "/",
    "user": user or "root",
}))
print(
    f"Image config: entrypoint={entrypoint}, cmd={cmd}, workdir={workdir or '/'}, user={user or 'root'}",
    file=sys.stderr,
)
PY
    ) || return 1
    printf '%s\n' "$output" > "$CONFIG_JSON_FILE"
}

create_summary() {
    mkdir -p "$(dirname "$SUMMARY_PATH")"
    python3 - "$SUMMARY_PATH" "$TIMINGS_FILE" "$CONFIG_JSON_FILE" <<'PY'
import json
import sys
from pathlib import Path

summary_path = Path(sys.argv[1])
timings_path = Path(sys.argv[2])
config_path = Path(sys.argv[3])

timings = []
if timings_path.exists():
    for line in timings_path.read_text().splitlines():
        if not line.strip():
            continue
        label, duration = line.split("|", 1)
        try:
            timings.append({"label": label, "duration": float(duration)})
        except ValueError:
            continue

config = {}
if config_path.exists():
    config = json.loads(config_path.read_text())

summary = {"timings": timings, "config": config}
summary_path.write_text(json.dumps(summary))
PY
    rm -f "$INSPECT_PATH"
}

main() {
    prepare_directories || return 1

    if [[ "$MODE" == "build" ]]; then
        run_step "build_snapshot:extract_repo_archive" extract_repo_archive || return 1
        run_step "build_snapshot:remote_build_image" build_image || return 1
        BUILT_IMAGE="$BUILD_TAG"
    else
        run_step "build_snapshot:remote_pull_image" pull_image || return 1
        BUILT_IMAGE="$IMAGE_NAME"
    fi

    run_step "build_snapshot:inspect_image" inspect_image || return 1
    run_step "build_snapshot:write_env_file" write_env_file || return 1
    run_step "build_snapshot:export_rootfs" export_rootfs || return 1
    run_step "build_snapshot:extract_rootfs" extract_rootfs || return 1
    run_step "build_snapshot:sync_resolv_conf" sync_resolv_conf || return 1
    run_step "build_snapshot:prepare_workspace" prepare_workspace || return 1
    run_step "build_snapshot:cleanup_build_workspace" cleanup_build_workspace || return 1
    run_step "build_snapshot:cleanup_docker" cleanup_docker || return 1
    run_step "build_snapshot:prepare_overlay" prepare_overlay || return 1
    run_step "build_snapshot:create_summary" create_summary || return 1
}

main "$@"
