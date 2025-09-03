#!/bin/bash
set -euo pipefail

# Script to generate icon files from iconset for Electron app
# This ensures the app icon is set before first launch

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
ICONSET_DIR="$PROJECT_DIR/assets/cmux-logos/cmux.iconset"

echo "Generating app icons..."

# Create build directory if it doesn't exist
mkdir -p "$BUILD_DIR"

# Generate icon.icns for macOS (if iconutil is available)
if [ ! -f "$BUILD_DIR/icon.icns" ]; then
  if command -v iconutil >/dev/null 2>&1; then
    if [ -d "$ICONSET_DIR" ]; then
      echo "Generating icon.icns from iconset..."
      iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns"
      echo "✓ Generated icon.icns"
    else
      echo "Error: iconset directory not found at $ICONSET_DIR" >&2
      exit 1
    fi
  else
    # On non-macOS systems, check if a pre-built icon.icns exists
    if [ "$(uname)" = "Darwin" ]; then
      echo "Error: iconutil not found on macOS, cannot generate icon.icns" >&2
      exit 1
    else
      echo "Note: iconutil not found (macOS only), icon.icns must be generated on macOS"
    fi
  fi
else
  echo "✓ Using existing icon.icns"
fi

# Generate icon.ico for Windows (using the largest PNG from iconset)
if command -v convert >/dev/null 2>&1; then
  if [ -f "$ICONSET_DIR/icon_256x256.png" ]; then
    echo "Generating icon.ico from PNG..."
    convert "$ICONSET_DIR/icon_16x16.png" \
            "$ICONSET_DIR/icon_32x32.png" \
            "$ICONSET_DIR/icon_128x128.png" \
            "$ICONSET_DIR/icon_256x256.png" \
            "$BUILD_DIR/icon.ico"
    echo "✓ Generated icon.ico"
  fi
elif command -v magick >/dev/null 2>&1; then
  if [ -f "$ICONSET_DIR/icon_256x256.png" ]; then
    echo "Generating icon.ico from PNG using ImageMagick..."
    magick "$ICONSET_DIR/icon_16x16.png" \
           "$ICONSET_DIR/icon_32x32.png" \
           "$ICONSET_DIR/icon_128x128.png" \
           "$ICONSET_DIR/icon_256x256.png" \
           "$BUILD_DIR/icon.ico"
    echo "✓ Generated icon.ico"
  fi
else
  echo "Note: ImageMagick not found, skipping ico generation"
fi

# Copy largest PNG for Linux
if [ -f "$ICONSET_DIR/icon_512x512.png" ]; then
  echo "Copying icon.png for Linux..."
  cp "$ICONSET_DIR/icon_512x512.png" "$BUILD_DIR/icon.png"
  echo "✓ Copied icon.png"
fi

# Also copy a 256x256 version as icon_256x256.png (some builders prefer this)
if [ -f "$ICONSET_DIR/icon_256x256.png" ]; then
  cp "$ICONSET_DIR/icon_256x256.png" "$BUILD_DIR/icon_256x256.png"
fi

echo "Icon generation complete!"
ls -la "$BUILD_DIR"/icon.* 2>/dev/null || echo "Generated icons will appear after running on appropriate platform"