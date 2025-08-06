#!/usr/bin/env tsx
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MorphProvider } from '../src/services/morph.js';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Default simple repository with devcontainer support
const DEFAULT_REPO = 'https://github.com/microsoft/vscode-remote-try-node';
const DEFAULT_BRANCH = 'main';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

async function main() {
  console.log('🔧 Debug Instance Utility\n');

  const morphProvider = await MorphProvider.create();
  
  // Set base snapshot ID from environment or use the default full snapshot
  const baseSnapshotId = process.env.MORPH_BASE_SNAPSHOT_ID || 'snapshot_7o3z2iez';
  morphProvider.setBaseSnapshotId(baseSnapshotId);
  console.log(`Using base snapshot: ${baseSnapshotId}\n`);
  
  try {
    // Ask for repository or use default
    const gitUrl = await question(`Git repository URL (default: ${DEFAULT_REPO}): `) || DEFAULT_REPO;
    const branch = await question(`Branch (default: ${DEFAULT_BRANCH}): `) || DEFAULT_BRANCH;
    
    console.log('\n📦 Creating preview environment...');
    console.log(`Repository: ${gitUrl}`);
    console.log(`Branch: ${branch}\n`);

    // Create preview environment
    const preview = await morphProvider.createPreviewEnvironment({
      gitUrl,
      branch,
      hasDevcontainer: true,
    });

    console.log(`✅ Preview created: ${preview.id}`);
    console.log('\n🌐 Service URLs:');
    
    if (preview.urls?.vscode) {
      console.log(`VSCode: ${preview.urls.vscode}`);
    }
    if (preview.urls?.worker) {
      console.log(`Worker: ${preview.urls.worker}`);
    }
    if (preview.urls?.preview) {
      console.log(`Preview: ${preview.urls.preview}`);
    }

    console.log('\n📋 Preview Details:');
    console.log(`Status: ${preview.status}`);
    console.log(`Created: ${preview.createdAt}`);
    
    console.log('\n🎯 What would you like to do?');
    console.log('1. Open VSCode in browser');
    console.log('2. Execute a command');
    console.log('3. Check instance status');
    console.log('4. Pause instance');
    console.log('5. Stop instance');
    console.log('6. Exit (keep instance running)');

    let running = true;
    while (running) {
      const choice = await question('\nEnter choice (1-6): ');
      
      switch (choice) {
        case '1':
          if (preview.urls?.vscode) {
            console.log(`\nOpen this URL in your browser: ${preview.urls.vscode}`);
            console.log('The VSCode instance is ready for use!');
          } else {
            console.log('VSCode URL not available yet.');
          }
          break;
          
        case '2':
          const command = await question('Enter command to execute: ');
          if (command) {
            console.log('\nExecuting command...');
            try {
              const result = await morphProvider.exec(preview.morphInstanceId || preview.id, command);
              console.log('Output:', result.stdout);
              if (result.stderr) {
                console.error('Error output:', result.stderr);
              }
              console.log('Exit code:', result.exitCode);
            } catch (error) {
              console.error('Failed to execute command:', error);
            }
          }
          break;
          
        case '3':
          const status = await morphProvider.getInstanceStatus(preview.morphInstanceId || preview.id);
          console.log('\nInstance Status:', JSON.stringify(status, null, 2));
          break;
          
        case '4':
          console.log('\nPausing preview...');
          if (preview.morphInstanceId) {
            const snapshotId = await morphProvider.createSnapshot(preview.morphInstanceId, {
              name: `pause-${preview.id}`,
              description: 'Paused preview environment'
            });
            await morphProvider.stopInstance(preview.morphInstanceId);
            console.log(`Preview paused. Snapshot ID: ${snapshotId}`);
            console.log('Use the resume functionality to restore it later.');
          } else {
            console.log('No instance ID available to pause.');
          }
          running = false;
          break;
          
        case '5':
          console.log('\nStopping preview...');
          if (preview.morphInstanceId) {
            await morphProvider.stopInstance(preview.morphInstanceId);
            console.log('Preview stopped.');
          } else {
            console.log('No instance ID available to stop.');
          }
          running = false;
          break;
          
        case '6':
          console.log('\nExiting... Preview will continue running.');
          console.log(`Preview ID: ${preview.id}`);
          console.log('You can manage it later using the preview service API.');
          running = false;
          break;
          
        default:
          console.log('Invalid choice. Please enter 1-6.');
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    rl.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nExiting...');
  rl.close();
  process.exit(0);
});

main().catch(console.error);