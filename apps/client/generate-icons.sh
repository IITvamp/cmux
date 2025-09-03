#!/bin/bash

# Script to generate application icons for electron-builder
# This ensures icons are available before the build process

ICONSET_DIR="assets/cmux-logos/cmux.iconset"
BUILD_DIR="build"
ICON_ICNS="$BUILD_DIR/icon.icns"

# Create build directory if it doesn't exist
mkdir -p "$BUILD_DIR"

# Check if iconset exists
if [ ! -d "$ICONSET_DIR" ]; then
  echo "Error: Iconset directory $ICONSET_DIR not found"
  exit 1
fi

# Generate icon.icns from iconset if iconutil is available (macOS)
if command -v iconutil >/dev/null 2>&1; then
  if [ ! -f "$ICON_ICNS" ]; then
    echo "Generating $ICON_ICNS from iconset..."
    iconutil -c icns "$ICONSET_DIR" -o "$ICON_ICNS"
    if [ $? -eq 0 ]; then
      echo "Successfully generated $ICON_ICNS"
    else
      echo "Failed to generate $ICON_ICNS"
      exit 1
    fi
  else
    echo "$ICON_ICNS already exists"
  fi
else
  echo "iconutil not available (not on macOS), skipping .icns generation"
fi

echo "Icon generation complete"