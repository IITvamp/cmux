#!/usr/bin/env bash
set -euo pipefail

# Local macOS arm64 build for Electron app (no notarization, no signing)
# Closely mirrors scripts/build-prod-mac-arm64.sh but skips all signing/notarize steps.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/apps/client"
ENTITLEMENTS="$CLIENT_DIR/build/entitlements.mac.plist"
DIST_DIR="$CLIENT_DIR/dist-electron"

ARCH_EXPECTED="arm64"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--env-file path] [--skip-install]

Builds macOS arm64 DMG/ZIP locally with no signing and no notarization.

Options:
  --env-file path        Source environment variables from a file before running
  --skip-install         Skip 'bun install --frozen-lockfile'

Notes:
  - Produces unsigned artifacts only.
  - No signing, notarization, or stapling is performed by this script.
EOF
}

ENV_FILE=""
SKIP_INSTALL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      if [[ -z "$ENV_FILE" ]]; then
        echo "--env-file requires a path" >&2
        exit 1
      fi
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

# Preconditions
if [[ "$(uname)" != "Darwin" ]]; then
  echo "This script must run on macOS." >&2
  exit 1
fi

HOST_ARCH="$(uname -m)"
if [[ "$HOST_ARCH" != "$ARCH_EXPECTED" ]]; then
  echo "Warning: Host architecture is '$HOST_ARCH', expected '$ARCH_EXPECTED'." >&2
  echo "Continuing anyway..." >&2
fi

command -v bun >/dev/null 2>&1 || { echo "bun is required. Install from https://bun.sh" >&2; exit 1; }

# Optional: source additional env vars
if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Env file not found: $ENV_FILE" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

echo "==> Generating icons"
(cd "$CLIENT_DIR" && bun run ./scripts/generate-icons.mjs)

echo "==> Preparing macOS entitlements"
bash "$ROOT_DIR/scripts/prepare-macos-entitlements.sh"

if [[ ! -f "$ENTITLEMENTS" ]]; then
  echo "Entitlements file missing at $ENTITLEMENTS" >&2
  exit 1
fi

if [[ "$SKIP_INSTALL" != "true" ]]; then
  echo "==> Installing dependencies (bun install --frozen-lockfile)"
  (cd "$ROOT_DIR" && bun install --frozen-lockfile)
fi

echo "==> Prebuilding mac app via prod script (workaround)"
bash "$ROOT_DIR/scripts/build-electron-prod.sh"

mkdir -p "$DIST_DIR"

echo "==> Packaging (unsigned; no notarization)"
export CSC_IDENTITY_AUTO_DISCOVERY=false
(cd "$CLIENT_DIR" && \
  bunx electron-builder \
    --config electron-builder.json \
    --mac dmg zip --arm64 \
    --publish never \
    --config.mac.identity=null \
    --config.dmg.sign=false)

echo "==> Done. Outputs in: $DIST_DIR"
