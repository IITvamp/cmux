#!/usr/bin/env bash
set -euo pipefail

# Local macOS arm64 build + sign + notarize for Electron app
# Mirrors the steps in .github/workflows/release-updates.yml (mac-arm64 job)

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/apps/client"
ENTITLEMENTS="$CLIENT_DIR/build/entitlements.mac.plist"
DIST_DIR="$CLIENT_DIR/dist-electron"

ARCH_EXPECTED="arm64"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--env-file path] [--skip-install]

Builds, signs, notarizes macOS arm64 DMG/ZIP locally.

Required env vars for signing + notarization:
  MAC_CERT_BASE64        Base64-encoded .p12 certificate
  MAC_CERT_PASSWORD      Password for the .p12 certificate
  APPLE_API_KEY          Apple API key (path or content as supported by electron-builder)
  APPLE_API_KEY_ID       Apple API Key ID
  APPLE_API_ISSUER       Apple API Issuer ID (UUID)

Optional env vars:
  DEBUG                  Set to 'electron-osx-sign*,electron-notarize*' for verbose logs

Options:
  --env-file path        Source environment variables from a file before running
  --skip-install         Skip 'bun install --frozen-lockfile'

Notes:
  - This script intentionally does NOT publish releases.
  - It mirrors workflow steps: generate icons, prepare entitlements, prebuild app,
    then package with electron-builder (sign + notarize), and staple/verify outputs.
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
command -v xcrun >/dev/null 2>&1 || { echo "xcrun is required (Xcode command line tools)." >&2; exit 1; }
command -v spctl >/dev/null 2>&1 || { echo "spctl is required (macOS)." >&2; exit 1; }

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

echo "==> Prebuilding mac app via local script (workaround)"
bash "$ROOT_DIR/scripts/build-electron-local.sh"

# Detect presence of signing + notarization secrets (mirror GH workflow)
echo "==> Detecting signing environment"
HAS_SIGNING=true
for k in MAC_CERT_BASE64 MAC_CERT_PASSWORD APPLE_API_KEY APPLE_API_KEY_ID APPLE_API_ISSUER; do
  if [[ -z "${!k:-}" ]]; then HAS_SIGNING=false; fi
done

if [[ "$HAS_SIGNING" == "true" ]]; then
  echo "==> Signing inputs detected; preparing certificate and Apple API key"
  TMPDIR_CERT="$(mktemp -d)"
  CERT_PATH="$TMPDIR_CERT/mac_signing_cert.p12"
  node -e "process.stdout.write(Buffer.from(process.env.MAC_CERT_BASE64,'base64'))" > "$CERT_PATH"
  export CSC_LINK="$CERT_PATH"
  export CSC_KEY_PASSWORD="${CSC_KEY_PASSWORD:-$MAC_CERT_PASSWORD}"

  # Prepare Apple API key for notarytool: ensure APPLE_API_KEY is a readable file path
  if [[ -f "${APPLE_API_KEY}" ]]; then
    : # already a file path
  else
    TMPDIR_APIKEY="$(mktemp -d)"
    API_KEY_PATH="$TMPDIR_APIKEY/AuthKey_${APPLE_API_KEY_ID:-api}.p8"
    printf "%s" "${APPLE_API_KEY}" | perl -0777 -pe 's/\r\n|\r|\n/\n/g' > "$API_KEY_PATH"
    export APPLE_API_KEY="$API_KEY_PATH"
  fi

  echo "==> Packaging (signed + notarized)"
  export DEBUG="${DEBUG:-electron-osx-sign*,electron-notarize*}"
  (cd "$CLIENT_DIR" && \
    bunx electron-builder \
      --config electron-builder.json \
      --mac dmg zip --arm64 \
      --publish never \
      --config.mac.forceCodeSigning=true \
      --config.mac.entitlements="$ENTITLEMENTS" \
      --config.mac.entitlementsInherit="$ENTITLEMENTS" \
      --config.mac.notarize=true)
else
  echo "==> No signing secrets; building unsigned like the commented GH path"
  # Avoid any auto identity discovery and explicitly disable signing
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  (cd "$CLIENT_DIR" && \
    bunx electron-builder \
      --config electron-builder.json \
      --mac dmg zip --arm64 \
      --publish never \
      --config.mac.identity=null \
      --config.dmg.sign=false)
fi

echo "==> Stapling and verifying outputs"
if [[ -d "$DIST_DIR" ]]; then
  pushd "$DIST_DIR" >/dev/null
  APP="$(ls -1d mac*/**/*.app 2>/dev/null | head -n1 || true)"
  DMG="$(ls -1 *.dmg 2>/dev/null | head -n1 || true)"

  if [[ -n "$APP" && -d "$APP" ]]; then
    echo "Stapling app: $APP"
    xcrun stapler staple "$APP" || true
    echo "Validating app stapling:"
    xcrun stapler validate "$APP" || true
    echo "Gatekeeper assessment for app:"
    spctl -a -t exec -vv "$APP"
  else
    echo "No .app found under $DIST_DIR/mac*/**/*.app" >&2
  fi

  if [[ -n "$DMG" && -f "$DMG" ]]; then
    echo "Stapling DMG: $DMG"
    xcrun stapler staple "$DMG" || true
    echo "Validating DMG stapling:"
    xcrun stapler validate "$DMG" || true
    echo "Gatekeeper assessment for DMG:"
    spctl -a -t open -vv "$DMG"
  else
    echo "No .dmg found under $DIST_DIR" >&2
  fi

  popd >/dev/null
else
  echo "Distribution directory not found: $DIST_DIR" >&2
fi

echo "==> Done. Outputs in: $DIST_DIR"
