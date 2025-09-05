#!/usr/bin/env bash
set -euo pipefail

# Build and run the cmux VS Code (code-server) container,
# then print the URL to connect.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

IMAGE_TAG_DEFAULT="cmux-worker:0.0.1"
CONTAINER_NAME_DEFAULT="cmux-vscode-$(date +%s)"
HOST_PORT_DEFAULT="39378"

IMAGE_TAG="$IMAGE_TAG_DEFAULT"
CONTAINER_NAME="$CONTAINER_NAME_DEFAULT"
HOST_PORT="${VSCODE_PORT:-$HOST_PORT_DEFAULT}"
REBUILD=false
DETACH=true
THEME="${VSCODE_THEME:-}" # optional: "light" | "dark" | "system"

usage() {
  echo "Usage: $0 [--image <tag>] [--name <container>] [--port <port>] [--no-detach] [--rebuild] [--theme <light|dark|system>]" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)
      IMAGE_TAG="$2"; shift 2;;
    --name)
      CONTAINER_NAME="$2"; shift 2;;
    --port)
      HOST_PORT="$2"; shift 2;;
    --no-detach)
      DETACH=false; shift;;
    --rebuild)
      REBUILD=true; shift;;
    --theme)
      THEME="$2"; shift 2;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown argument: $1" >&2; usage; exit 1;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found in PATH. Please install Docker first." >&2
  exit 1
fi

mkdir -p logs

# Find a free TCP port starting at HOST_PORT
find_free_port() {
  local port="$1"
  while lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port+1))
  done
  echo "$port"
}

HOST_PORT="$(find_free_port "$HOST_PORT")"

echo "[cmux] Building image: $IMAGE_TAG"
if $REBUILD; then
  docker build --no-cache -t "$IMAGE_TAG" .
else
  docker build -t "$IMAGE_TAG" .
fi

# Ensure DinD storage volume exists to persist inner Docker state (optional)
docker volume inspect cmux_dind_data >/dev/null 2>&1 || docker volume create cmux_dind_data >/dev/null

# Remove existing container with same name if present
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "[cmux] Removing existing container: $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

echo "[cmux] Starting container: $CONTAINER_NAME (port $HOST_PORT -> 39378)"

RUN_FLAGS=(
  --name "$CONTAINER_NAME"
  --privileged
  -p "$HOST_PORT:39378"
  -v "$REPO_ROOT:/root/workspace"
  -v cmux_dind_data:/var/lib/docker
  -e "VSCODE_THEME=$THEME"
)

if $DETACH; then
  RUN_FLAGS=(-d "${RUN_FLAGS[@]}")
fi

docker run "${RUN_FLAGS[@]}" "$IMAGE_TAG" >/dev/null

# Wait for VS Code serve-web to be ready inside the container
URL="http://localhost:${HOST_PORT}"
echo "[cmux] Waiting for VS Code serve-web to be ready..."
ATTEMPTS=120
SLEEP_SECS=1
for i in $(seq 1 "$ATTEMPTS"); do
  # Check if VS Code serve-web is responding
  if curl -s "$URL" 2>/dev/null | grep -q "<!DOCTYPE html>\|Workbench"; then
    echo "[cmux] VS Code serve-web is ready!"
    break
  fi
  if [ $((i % 10)) -eq 0 ]; then
    echo "[cmux] Still waiting... ($i/$ATTEMPTS)"
  fi
  sleep "$SLEEP_SECS"
done

if [ $i -eq $ATTEMPTS ]; then
  echo "[cmux] Warning: VS Code web server may not be ready yet"
  echo "[cmux] Checking container logs:"
  docker logs --tail 20 "$CONTAINER_NAME" 2>&1
fi

echo "[cmux] Container: $CONTAINER_NAME"
echo "[cmux] VS Code Web URL: http://localhost:${HOST_PORT}"
echo "[cmux] Open this URL in your browser to access VS Code"

if ! $DETACH; then
  echo "[cmux] Attaching logs (Ctrl+C to stop)"
  docker logs -f "$CONTAINER_NAME"
fi

