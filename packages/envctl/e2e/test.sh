#!/usr/bin/env bash
set -euo pipefail

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
