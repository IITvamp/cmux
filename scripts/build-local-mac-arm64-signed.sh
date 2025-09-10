#!/usr/bin/env bash
set -euo pipefail

# Local macOS arm64 signed build helper.
# - Ensures entitlements file exists (apps/client/build/entitlements.mac.plist)
# - Performs prebuild workaround
# - Runs electron-builder with signing and optional notarization if creds provided

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

echo "[1/6] Installing dependencies with bun (frozen lockfile)..."
bun install --frozen-lockfile

echo "[2/6] Preparing macOS entitlements..."
bash scripts/prepare-macos-entitlements.sh

if [[ ! -f .env ]]; then
  echo "[warn] .env not found at repo root. Using existing environment if available." >&2
fi

echo "[3/6] Generating icons (apps/client)..."
(cd apps/client && bun run ./scripts/generate-icons.mjs)

echo "[4/6] Pre-building app via local workaround script (apps/client)..."
bash scripts/build-electron-local.sh

echo "[5/6] Validating signing environment..."
# Accept either Developer ID via keychain (CSC_NAME) or P12 via CSC_LINK/CSC_KEY_PASSWORD
HAS_SIGNING=false
if [[ -n "${CSC_NAME:-}" ]]; then HAS_SIGNING=true; fi
if [[ -n "${CSC_LINK:-}" && -n "${CSC_KEY_PASSWORD:-}" ]]; then HAS_SIGNING=true; fi

if [[ "$HAS_SIGNING" != "true" ]]; then
  echo "Error: No signing identity configured." >&2
  echo "Provide either:" >&2
  echo "  - CSC_NAME='Developer ID Application: Your Name (TEAMID)'" >&2
  echo "    (Use 'security find-identity -p codesigning -v' to list identities)" >&2
  echo "  - or CSC_LINK=<path|base64> and CSC_KEY_PASSWORD=<password> for a .p12 cert" >&2
  exit 2
fi

NOTARIZE=false
if [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]; then
  NOTARIZE=true
fi

echo "[6/6] Running electron-builder for macOS arm64 (signed, local artifacts)..."
(
  export DEBUG=electron-osx-sign*,electron-notarize*
  export CSC_IDENTITY_AUTO_DISCOVERY=true
  cd apps/client && bunx electron-builder \
    --config electron-builder.json \
    --mac dmg zip --arm64 \
    --publish never \
    --config.mac.forceCodeSigning=true \
    ${NOTARIZE:+--config.mac.notarize=true}
)

echo "Build complete. Artifacts:"
echo "  - App bundle: apps/client/dist-electron/mac-arm64/Cmux.app"
echo "  - DMG/ZIP:   apps/client/dist-electron/"
echo "You can open the app with:"
echo "  open apps/client/dist-electron/mac-arm64/Cmux.app"

