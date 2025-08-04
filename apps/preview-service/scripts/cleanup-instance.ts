#!/usr/bin/env tsx
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MorphCloudClient } from 'morphcloud';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const instanceId = process.argv[2];
  
  if (!instanceId) {
    console.error('Usage: tsx scripts/cleanup-instance.ts <instance-id>');
    process.exit(1);
  }

  const client = new MorphCloudClient();
  
  try {
    console.log(`Stopping instance ${instanceId}...`);
    const instance = await client.instances.get({ instanceId });
    await instance.stop();
    console.log('✅ Instance stopped');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);