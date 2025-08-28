# Electron Auto-Updates Setup

This document explains how to use the auto-update functionality for the Cmux Electron app.

## Overview

The app now supports automatic updates via GitHub releases using `electron-updater`. Updates are checked automatically on app startup (in production builds only).

## Setup Requirements

### 1. GitHub Repository Configuration

1. **Update electron-builder.json**: Replace `"your-github-username"` with your actual GitHub username in the `publish.owner` field:

```json
"publish": {
  "provider": "github",
  "owner": "your-actual-github-username",
  "repo": "cmux"
}
```

2. **GitHub Token**: Create a GitHub Personal Access Token with `repo` permissions and add it as a repository secret:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add a new repository secret named `GH_TOKEN` with your personal access token

### 2. Build and Publish Process

#### Install Dependencies

```bash
cd apps/client
pnpm install
```

#### Build for All Platforms

```bash
# Build for all platforms (macOS, Windows, Linux)
pnpm run build:all

# Or build for specific platforms
pnpm run build:mac    # macOS only
pnpm run build:win    # Windows only
pnpm run build:linux  # Linux only
```

#### Publish to GitHub Releases

```bash
# Publish to GitHub releases (requires GH_TOKEN)
pnpm run publish:all
```

## How It Works

### Automatic Updates

- Updates are checked automatically when the app starts (production builds only)
- If an update is available, users see a notification dialog
- The update downloads in the background
- When download completes, users are prompted to restart the app

### Manual Update Check

The auto-updater runs automatically. No manual intervention is needed.

### Update Process

1. App checks for updates on startup
2. If update available → Show "Update Available" dialog
3. Download happens in background
4. When complete → Show "Update Ready" dialog with Restart/Later options
5. On restart → New version installs and launches

## Cross-Platform Support

The configuration supports:

- **macOS**: DMG files for both Intel (x64) and Apple Silicon (arm64)
- **Windows**: NSIS installer for both 64-bit and 32-bit
- **Linux**: AppImage and Debian packages for 64-bit

## Troubleshooting

### Common Issues

1. **"Cannot find module 'electron-updater'"**
   - Run `pnpm install` in the client directory

2. **Publishing fails**
   - Ensure `GH_TOKEN` secret is set in GitHub repository
   - Verify the token has `repo` permissions
   - Check that the repository owner matches the `publish.owner` in electron-builder.json

3. **Updates not detected**
   - Ensure releases are published with proper assets
   - Check that the release version is higher than the current app version
   - Verify the app is built in production mode (not dev mode)

### Development Mode

Auto-updates are disabled in development mode (`is.dev` is true). To test updates:

1. Build a production version: `pnpm run build:electron`
2. Create a GitHub release with the built assets
3. Install and run the production build
4. Create another release with a higher version number
5. The production app should detect and offer the update

## File Structure

```
apps/client/
├── electron-builder.json          # Build configuration with publish settings
├── package.json                   # Dependencies and build scripts
├── electron/main/
│   └── index.ts                   # Main process with auto-updater logic
└── ELECTRON_AUTOUPDATES.md        # This documentation
```

## Security Notes

- Only publish from trusted CI/CD environments
- Keep GitHub tokens secure and rotate regularly
- Test updates thoroughly before releasing to users
- Consider using code signing for production releases
