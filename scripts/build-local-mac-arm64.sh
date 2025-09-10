#!/usr/bin/env bash
set -euo pipefail

# Local macOS arm64 build, mirroring .github/workflows/release-updates.yml (mac-arm64)

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS." >&2
  exit 1
fi

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "This script targets macOS arm64; detected: $(uname -m)" >&2
  exit 1
fi

echo "[1/5] Installing dependencies with bun (frozen lockfile)..."
bun install --frozen-lockfile

if [[ ! -f .env ]]; then
  echo "[warn] .env not found at repo root. Using existing environment if available." >&2
fi

echo "[2/5] Generating icons (apps/client)..."
(cd apps/client && bun run ./scripts/generate-icons.mjs)

echo "[3/5] Pre-building app via local workaround script (apps/client)..."
bash scripts/build-electron-local.sh

echo "[4/5] Running electron-builder for macOS arm64 (unsigned, local artifacts)..."
export CSC_IDENTITY_AUTO_DISCOVERY=true
# Extra guardrails against signing on local machines with valid Developer ID identities.
unset CSC_NAME || true
unset CSC_LINK || true
unset CSC_KEY_PASSWORD || true
( \
  export DEBUG=electron-osx-sign*,electron-notarize*; \
  cd apps/client && bunx electron-builder \
    --config electron-builder.local.json \
    --mac dmg zip --arm64 \
)

echo "[5/5] Build complete. Artifacts:"
echo "  - App bundle: apps/client/dist-electron/mac-arm64/Cmux.app"
echo "  - DMG/ZIP:   apps/client/dist-electron/"

echo "Done. You can open the app with:"
echo "  open apps/client/dist-electron/mac-arm64/Cmux.app"
