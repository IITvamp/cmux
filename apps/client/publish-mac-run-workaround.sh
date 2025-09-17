#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_PATH="$SCRIPT_DIR/node_modules/.bin/electron-vite"

if [ -f "$BIN_PATH" ] && [ ! -L "$BIN_PATH" ]; then
  if grep -q "../dist/cli.js" "$BIN_PATH"; then
    echo "Patching electron-vite binary for publish build (copied node_modules)..."
    TMP_FILE="$(mktemp)"
    sed "s#../dist/cli.js#../electron-vite/dist/cli.js#g" "$BIN_PATH" > "$TMP_FILE"
    mv "$TMP_FILE" "$BIN_PATH"
    chmod +x "$BIN_PATH"
  fi
fi

exec "$SCRIPT_DIR/build-mac-workaround.sh" "$@"
