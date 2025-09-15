#!/usr/bin/env bash
set -euo pipefail

# Skip test if Docker tests are disabled or docker command is not available
if [ "${CMUX_SKIP_DOCKER_TESTS:-0}" = "1" ]; then
  echo "Skipping envctl e2e test (CMUX_SKIP_DOCKER_TESTS=1)"
  exit 0
fi

if ! command -v docker &> /dev/null; then
  echo "Skipping envctl e2e test (docker command not found)"
  exit 0
fi

IMG="oven/bun:1"
ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd -P)"

echo "Pulling $IMG (if needed)..."
docker pull "$IMG" >/dev/null || true

echo "Running e2e in Docker (Linux, Bun)..."
docker run --rm -t \
  -e XDG_RUNTIME_DIR=/tmp \
  -v "$ROOT_DIR":/work \
  -w /work \
  "$IMG" \
  bash -lc "bash packages/envctl/e2e/inside.sh"

echo "E2E completed"
