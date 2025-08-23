#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Skip electron symlink creation in CI/Docker environments
if (process.env.CI === '1' || process.env.DOCKER_BUILD === '1') {
  console.log('Skipping electron symlink creation in CI/Docker environment');
  process.exit(0);
}

// Create symlinks for electron in client app after pnpm install
// This ensures electron-builder can find electron regardless of hoisting

const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'apps', 'client');

// Skip if client app doesn't exist (partial workspace install in Docker)
if (!fs.existsSync(clientDir)) {
  console.log('Client app not found, skipping electron symlink creation');
  process.exit(0);
}

const clientNodeModules = path.join(clientDir, 'node_modules');
const rootNodeModules = path.join(rootDir, 'node_modules');

// Ensure client node_modules exists
if (!fs.existsSync(clientNodeModules)) {
  fs.mkdirSync(clientNodeModules, { recursive: true });
}

// Create relative symlink for electron if it exists in root node_modules
const electronPath = path.join(rootNodeModules, 'electron');
const electronLinkPath = path.join(clientNodeModules, 'electron');

if (fs.existsSync(electronPath)) {
  // Remove existing link/file/directory if it exists
  try {
    const stats = fs.lstatSync(electronLinkPath);
    if (stats.isSymbolicLink()) {
      fs.unlinkSync(electronLinkPath);
    } else if (stats.isDirectory()) {
      fs.rmSync(electronLinkPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(electronLinkPath);
    }
  } catch (e) {
    // Ignore if doesn't exist
  }
  
  // Create relative symlink
  // Use 'dir' type on Windows, 'junction' on other platforms
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  const relativePath = path.relative(clientNodeModules, electronPath);
  
  try {
    fs.symlinkSync(relativePath, electronLinkPath, linkType);
    console.log('Created electron symlink in apps/client/node_modules');
  } catch (err) {
    console.error('Failed to create electron symlink:', err.message);
    console.log('You may need to run the build:mac:workaround script instead');
  }
}