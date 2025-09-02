#!/bin/bash

# Build the Electron app first
echo "Building Electron app..."
npx electron-vite build -c electron.vite.config.js

# Create a temporary directory for packaging
TEMP_DIR=$(mktemp -d)
APP_NAME="Cmux"
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

# Copy node_modules (preserving symlinks for pnpm)
echo "Copying dependencies..."
cp -r node_modules "$APP_ASAR_DIR/"

# Update Info.plist
echo "Updating app metadata..."
/usr/libexec/PlistBuddy -c "Set :CFBundleName $APP_NAME" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $APP_NAME" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.cmux.app" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 1.0.0" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString 1.0.0" "$APP_DIR/Contents/Info.plist"

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

# Create output directory based on architecture
OUTPUT_DIR="dist-electron/mac-$ELECTRON_ARCH"
mkdir -p "$OUTPUT_DIR"

# Move the app
echo "Moving app to $OUTPUT_DIR..."
rm -rf "$OUTPUT_DIR/$APP_NAME.app"
mv "$APP_DIR" "$OUTPUT_DIR/"

# Clean up
rm -rf "$TEMP_DIR"

echo "Build complete! App is at $OUTPUT_DIR/$APP_NAME.app"
echo "You can run it with: open $OUTPUT_DIR/$APP_NAME.app"
