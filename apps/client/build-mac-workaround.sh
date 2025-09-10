#!/bin/bash
set -e

# remove existing build
rm -rf dist-electron
rm -rf out

# Build the Electron app first with environment variables loaded
echo "Building Electron app..."
# Load environment variables from .env file
set -a  # Mark all new variables for export
source ../../.env
set +a  # Turn off auto-export

# Build native Rust addon (required)
echo "Building native Rust addon for packaging (release)..."
(cd ../../apps/server/native/time && bunx --bun @napi-rs/cli build --platform --release)
npx electron-vite build -c electron.vite.config.ts

# Create a temporary directory for packaging
TEMP_DIR=$(mktemp -d)
APP_NAME="cmux"
APP_DIR="$TEMP_DIR/$APP_NAME.app"

echo "Creating app structure at $APP_DIR..."

# Download Electron binary if not cached
ELECTRON_VERSION="37.2.4"
ELECTRON_CACHE="${HOME}/.cache/electron"
ARCH=$(uname -m)

# Map architecture names
if [ "$ARCH" = "x86_64" ]; then
    ELECTRON_ARCH="x64"
elif [ "$ARCH" = "arm64" ]; then
    ELECTRON_ARCH="arm64"
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

ELECTRON_ZIP="$ELECTRON_CACHE/electron-v$ELECTRON_VERSION-darwin-$ELECTRON_ARCH.zip"

if [ ! -f "$ELECTRON_ZIP" ]; then
    echo "Downloading Electron v$ELECTRON_VERSION for $ELECTRON_ARCH..."
    mkdir -p "$ELECTRON_CACHE"
    curl -L "https://github.com/electron/electron/releases/download/v$ELECTRON_VERSION/electron-v$ELECTRON_VERSION-darwin-$ELECTRON_ARCH.zip" -o "$ELECTRON_ZIP"
fi

# Extract Electron
echo "Extracting Electron..."
unzip -q "$ELECTRON_ZIP" -d "$TEMP_DIR"
mv "$TEMP_DIR/Electron.app" "$APP_DIR"

# Copy app files
echo "Copying app files..."
RESOURCES_DIR="$APP_DIR/Contents/Resources"
APP_ASAR_DIR="$RESOURCES_DIR/app"
mkdir -p "$APP_ASAR_DIR"

# Copy built files
cp -r out "$APP_ASAR_DIR/"
cp package.json "$APP_ASAR_DIR/"

echo "Copying dependencies..."
cp -r node_modules "$APP_ASAR_DIR/"

# Update Info.plist
echo "Updating app metadata..."
/usr/libexec/PlistBuddy -c "Set :CFBundleName $APP_NAME" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $APP_NAME" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.cmux.app" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 1.0.0" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString 1.0.0" "$APP_DIR/Contents/Info.plist"

# Register cmux:// URL scheme so macOS knows to open this app for deep links
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" "$APP_DIR/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0 dict" "$APP_DIR/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLName string cmux" "$APP_DIR/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$APP_DIR/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string cmux" "$APP_DIR/Contents/Info.plist" 2>/dev/null || true

# Ensure our app icon is bundled and used by macOS
ICONSET_SRC="$(pwd)/assets/cmux-logos/cmux.iconset"
BUILD_ICON_ICNS="$(pwd)/build/icon.icns"
if [ -d "$ICONSET_SRC" ]; then
  echo "Copying iconset into Resources..."
  mkdir -p "$RESOURCES_DIR/cmux-logos"
  rsync -a "$ICONSET_SRC/" "$RESOURCES_DIR/cmux-logos/cmux.iconset/"
  if [ ! -f "$BUILD_ICON_ICNS" ] && command -v iconutil >/dev/null 2>&1; then
    echo "Generating build/icon.icns from iconset..."
    iconutil -c icns "$ICONSET_SRC" -o "$BUILD_ICON_ICNS"
  fi
fi

if [ -f "$BUILD_ICON_ICNS" ]; then
  echo "Installing app icon..."
  cp "$BUILD_ICON_ICNS" "$RESOURCES_DIR/Cmux.icns"
  /usr/libexec/PlistBuddy -c "Set :CFBundleIconFile Cmux" "$APP_DIR/Contents/Info.plist"
else
  echo "WARNING: build/icon.icns not found; app icon may remain default" >&2
fi

# Rename executable
mv "$APP_DIR/Contents/MacOS/Electron" "$APP_DIR/Contents/MacOS/$APP_NAME"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable $APP_NAME" "$APP_DIR/Contents/Info.plist"

# Bundle native Rust addon (.node) into Resources so runtime loader can find it
echo "Bundling native Rust addon (.node) into Resources..."
NATIVE_SRC_DIR="$(pwd)/../../apps/server/native/time"
NATIVE_DST_DIR="$RESOURCES_DIR/native/time"
mkdir -p "$NATIVE_DST_DIR"
shopt -s nullglob
NODE_BINARIES=("$NATIVE_SRC_DIR"/index.*.node)
if [ ${#NODE_BINARIES[@]} -gt 0 ]; then
  echo "Copying ${#NODE_BINARIES[@]} native binary(ies) from $NATIVE_SRC_DIR to $NATIVE_DST_DIR"
  for f in "${NODE_BINARIES[@]}"; do
    cp -f "$f" "$NATIVE_DST_DIR/"
  done
else
  echo "ERROR: No native .node binary found in $NATIVE_SRC_DIR. Build failed." >&2
  exit 1
fi
shopt -u nullglob

# Create output directory based on architecture
OUTPUT_DIR="dist-electron/mac-$ELECTRON_ARCH"
mkdir -p "$OUTPUT_DIR"

# Move the app
echo "Moving app to $OUTPUT_DIR..."
rm -rf "$OUTPUT_DIR/$APP_NAME.app"
mv "$APP_DIR" "$OUTPUT_DIR/"

# Clean up
rm -rf "$TEMP_DIR"

echo "Build complete! App is at $(pwd)/$OUTPUT_DIR/$APP_NAME.app"
echo "You can run it with: open $(pwd)/$OUTPUT_DIR/$APP_NAME.app"
