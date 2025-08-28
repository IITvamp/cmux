# Auto-Update Setup

This document explains how to use the auto-update functionality for Cmux.

## Overview

Cmux uses electron-updater to provide automatic updates via GitHub releases. The system supports Windows, macOS, and Linux.

## Configuration

### GitHub Repository Setup

1. Update `electron-builder.json` with your GitHub repository information:

   ```json
   "publish": {
     "provider": "github",
     "owner": "your-github-username",
     "repo": "cmux"
   }
   ```

2. Create a GitHub Personal Access Token with `repo` permissions
3. Set the token as an environment variable: `GH_TOKEN=your_token_here`

### Building and Publishing

To create a new release:

1. Update the version in `package.json`
2. Build and publish:
   ```bash
   npm run dist:publish
   ```

This will:

- Build the app for all platforms
- Create GitHub releases
- Upload release assets

### Manual Update Check

Users can manually check for updates using:

```javascript
await window.api.checkForUpdates();
```

## How It Works

1. **Automatic Updates**: The app checks for updates on startup (production only)
2. **Background Download**: Updates are downloaded silently in the background
3. **User Notification**: Users are notified when updates are available/downloaded
4. **Restart**: Users can choose when to restart and apply the update

## Development

- Auto-updates are disabled in development mode
- Use `npm run build:electron` for development builds
- Use `npm run dist:publish` for production releases

## Troubleshooting

- Ensure `GH_TOKEN` is set with proper permissions
- Check that release assets are uploaded to GitHub
- Verify that the app is not in development mode
- Check console logs for update-related errors
