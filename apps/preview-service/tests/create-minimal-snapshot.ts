#!/usr/bin/env bun
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MorphCloudClient } from 'morphcloud';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

if (!process.env.MORPH_API_KEY) {
  console.error('Error: MORPH_API_KEY not found');
  process.exit(1);
}

async function main() {
  const client = new MorphCloudClient();
  
  try {
    // Use existing base snapshot
    const baseSnapshotId = process.env.MORPH_BASE_SNAPSHOT_ID || 'snapshot_7o3z2iez';
    console.log(`📦 Starting from base snapshot ${baseSnapshotId}...`);
    
    const instance = await client.instances.start({ snapshotId: baseSnapshotId });
    await instance.waitUntilReady();
    console.log('✅ Instance ready:', instance.id);

    // Quick test
    console.log('\n🧪 Testing instance...');
    const result = await instance.exec('echo "Hello from instance"');
    console.log('Output:', result.stdout);

    // Create snapshot immediately
    console.log('\n📸 Creating snapshot...');
    const snapshot = await instance.snapshot({
      metadata: {
        name: `cmux-preview-minimal-${Date.now()}`,
        description: 'Minimal test snapshot',
      },
    });

    console.log(`\n✅ Successfully created snapshot: ${snapshot.id}`);
    
    // Stop instance
    console.log('\n🧹 Stopping instance...');
    await instance.stop();

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});