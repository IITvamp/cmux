#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${1:-cmux-local-sanity}"
CONTAINER_NAME="cmux-local-sanity"
PLATFORM="linux/amd64"
OPENVSCODE_URL="http://localhost:39378/?folder=/root/workspace"

cleanup() {
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "[sanity] Building local runtime image ($IMAGE_NAME)..."
docker build --platform "$PLATFORM" -t "$IMAGE_NAME" .

cleanup

echo "[sanity] Starting container..."
docker run -d \
  --rm \
  --privileged \
  --cgroupns=host \
  --tmpfs /run \
  --tmpfs /run/lock \
  -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
  -v cmux-local-docker:/var/lib/docker \
  -p 39376:39376 \
  -p 39377:39377 \
  -p 39378:39378 \
  --name "$CONTAINER_NAME" \
  "$IMAGE_NAME" >/dev/null

echo "[sanity] Waiting for OpenVSCode to respond..."
for i in {1..60}; do
  if curl -fsS "$OPENVSCODE_URL" >/dev/null 2>&1; then
    echo "[sanity] OpenVSCode reachable at $OPENVSCODE_URL"
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then
    echo "[sanity] ERROR: OpenVSCode did not become ready within 60s" >&2
    docker logs "$CONTAINER_NAME" || true
    exit 1
  fi
done

check_unit() {
  local unit="$1"
  if ! docker exec "$CONTAINER_NAME" systemctl is-active --quiet "$unit"; then
    echo "[sanity] ERROR: systemd unit $unit is not active" >&2
    docker exec "$CONTAINER_NAME" systemctl status "$unit" || true
    exit 1
  fi
  echo "[sanity] systemd unit $unit is active"
}

check_unit cmux-openvscode.service
check_unit cmux-worker.service

HOST_ARCH=$(uname -m)
if [[ "$HOST_ARCH" == "x86_64" || "$HOST_ARCH" == "amd64" ]]; then
  echo "[sanity] Running DinD hello-world test..."
  docker exec "$CONTAINER_NAME" docker run --rm hello-world >/dev/null
  echo "[sanity] DinD hello-world succeeded"
else
  echo "[sanity] Skipping DinD hello-world on host arch $HOST_ARCH (known qemu instability)." >&2
fi

echo "[sanity] All checks passed."
