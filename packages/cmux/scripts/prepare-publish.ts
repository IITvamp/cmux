import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const projectRoot = path.resolve(__dirname, '..');
const uploadArtifactDir = path.join(projectRoot, 'upload-artifact');

function preparePublish(): void {
  console.log('📦 Preparing secure publish artifact...\n');
  
  // Clean up any existing upload-artifact directory
  if (fs.existsSync(uploadArtifactDir)) {
    console.log('Cleaning existing upload-artifact directory...');
    fs.rmSync(uploadArtifactDir, { recursive: true, force: true });
  }
  
  // Create fresh upload-artifact directory
  fs.mkdirSync(uploadArtifactDir);
  console.log('Created clean upload-artifact directory\n');
  
  // Copy package.json
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
  
  // Remove scripts that shouldn't be in published package
  const publishPackageJson = {
    ...packageJson,
    scripts: {
      start: packageJson.scripts.start
    },
    devDependencies: undefined  // Remove devDependencies from published package
  };
  
  fs.writeFileSync(
    path.join(uploadArtifactDir, 'package.json'),
    JSON.stringify(publishPackageJson, null, 2)
  );
  console.log('✓ Copied package.json (removed dev scripts and devDependencies)');
  
  // Copy only the files specified in the "files" field
  const filesToCopy = packageJson.files || ['dist'];
  
  for (const file of filesToCopy) {
    const sourcePath = path.join(projectRoot, file);
    const destPath = path.join(uploadArtifactDir, file);
    
    if (fs.existsSync(sourcePath)) {
      if (fs.statSync(sourcePath).isDirectory()) {
        copyDirectory(sourcePath, destPath);
        console.log(`✓ Copied directory: ${file}`);
      } else {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✓ Copied file: ${file}`);
      }
    } else {
      console.warn(`⚠️  Warning: ${file} specified in "files" but does not exist`);
    }
  }
  
  // Copy README if it exists
  const readmePath = path.join(projectRoot, 'README.md');
  if (fs.existsSync(readmePath)) {
    fs.copyFileSync(readmePath, path.join(uploadArtifactDir, 'README.md'));
    console.log('✓ Copied README.md');
  }
  
  // Copy LICENSE if it exists
  const licensePath = path.join(projectRoot, 'LICENSE');
  if (fs.existsSync(licensePath)) {
    fs.copyFileSync(licensePath, path.join(uploadArtifactDir, 'LICENSE'));
    console.log('✓ Copied LICENSE');
  }
  
  console.log('\n📊 Upload artifact contents:');
  listDirectoryContents(uploadArtifactDir, '');
  
  console.log('\n✅ Upload artifact prepared successfully!');
  console.log(`📁 Location: ${uploadArtifactDir}`);
  console.log('\nTo publish: cd upload-artifact && npm publish');
}

function copyDirectory(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function listDirectoryContents(dir: string, prefix: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1;
    const marker = isLast ? '└── ' : '├── ';
    console.log(`${prefix}${marker}${entry.name}`);
    
    if (entry.isDirectory()) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      listDirectoryContents(path.join(dir, entry.name), newPrefix);
    }
  });
}

// Run the preparation
preparePublish();