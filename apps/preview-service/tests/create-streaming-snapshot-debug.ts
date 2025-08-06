#!/usr/bin/env bun
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MorphProvider } from '../src/services/morph.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

if (!process.env.MORPH_API_KEY) {
  console.error('Error: MORPH_API_KEY not found');
  process.exit(1);
}

async function exec(provider: MorphProvider, instanceId: string, command: string, showOutput = true): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (showOutput) console.log(`\n$ ${command}`);
  try {
    const result = await provider.exec(instanceId, command);
    if (showOutput) {
      if (result.stdout) console.log(result.stdout);
      if (result.stderr) console.error(result.stderr);
    }
    return result;
  } catch (error) {
    console.error('Exec error:', error);
    throw error;
  }
}

async function main() {
  const provider = new MorphProvider();
  let instanceId: string | null = null;

  try {
    // Use existing base snapshot
    const baseSnapshotId = process.env.MORPH_BASE_SNAPSHOT_ID || 'snapshot_7o3z2iez';
    console.log(`📦 Starting from base snapshot ${baseSnapshotId}...`);
    
    const instance = await provider.createInstance({ snapshotId: baseSnapshotId });
    instanceId = instance.id;
    await provider.waitForInstance(instanceId);
    console.log('✅ Instance ready');

    // Read the streaming worker code
    const workerCode = await fs.readFile(
      path.join(__dirname, '../src/worker/streaming-worker.cjs'),
      'utf-8'
    );

    // Update the worker with streaming support
    console.log('\n📝 Updating worker with streaming exec support...');
    
    // Upload the worker code directly using provider abstraction
    await provider.uploadFile(instanceId, workerCode, '/builtins/build/index.js');
    console.log('✅ Worker file uploaded');

    // Check if file was written correctly
    console.log('\n🔍 Verifying worker file...');
    const checkResult = await exec(provider, instanceId, 'ls -la /builtins/build/index.js');
    
    // Kill existing worker
    console.log('\n🔄 Stopping existing worker...');
    const killResult = await exec(provider, instanceId, 'pkill -f "node /builtins/build/index.js" || true');
    console.log('Exit code:', killResult.exitCode);
    
    // Start new worker
    console.log('\n🚀 Starting new worker...');
    const startResult = await exec(provider, instanceId, 'cd /builtins && nohup node /builtins/build/index.js > /var/log/cmux/worker.log 2>&1 & echo "Started with PID $!"');
    
    // Wait for worker to start
    console.log('\n⏳ Waiting for worker to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test the worker
    console.log('\n🧪 Testing worker...');
    const psResult = await exec(provider, instanceId, 'ps aux | grep "node /builtins/build/index.js" | grep -v grep');
    if (psResult.stdout) {
      console.log('✅ Worker is running with streaming support');
    } else {
      console.log('❌ Worker not found in process list');
      // Check logs
      console.log('\n📋 Worker logs:');
      await exec(provider, instanceId, 'tail -n 20 /var/log/cmux/worker.log || echo "No logs found"');
    }

    // Create final snapshot
    console.log('\n📸 Creating snapshot with streaming worker...');
    const finalSnapshotId = await provider.createSnapshot(instanceId, {
      name: `cmux-preview-streaming-${Date.now()}`,
      description: 'Base snapshot with streaming exec support in worker',
    });

    console.log(`\n✅ Successfully created snapshot: ${finalSnapshotId}`);
    
    // Update .env file
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch {
      // File doesn't exist
    }
    
    // Update or add the snapshot ID
    if (envContent.includes('MORPH_BASE_SNAPSHOT_ID=')) {
      envContent = envContent.replace(/MORPH_BASE_SNAPSHOT_ID=.*/, `MORPH_BASE_SNAPSHOT_ID=${finalSnapshotId}`);
    } else {
      envContent += `\nMORPH_BASE_SNAPSHOT_ID=${finalSnapshotId}\n`;
    }
    
    await fs.writeFile(envPath, envContent);
    console.log(`\n📝 Updated snapshot ID in ${envPath}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    if (instanceId) {
      console.log('\n🧹 Stopping instance...');
      await provider.stopInstance(instanceId);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});