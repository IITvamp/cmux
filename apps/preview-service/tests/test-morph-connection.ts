#!/usr/bin/env tsx
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MorphCloudClient } from 'morphcloud';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from root .env file
const rootEnvPath = path.join(__dirname, '../../../.env');
console.log('Loading .env from:', rootEnvPath);
const result = dotenv.config({ path: rootEnvPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

console.log('Environment variables loaded');
console.log('MORPH_API_KEY:', process.env.MORPH_API_KEY ? 'Found' : 'Not found');

async function testConnection() {
  try {
    const client = new MorphCloudClient();
    console.log('MorphCloudClient created successfully');
    
    // Try to list snapshots to test the connection
    console.log('Testing API connection...');
    const snapshots = await client.snapshots.list();
    console.log(`Found ${snapshots.length} snapshots`);
    
    console.log('✅ Morph API connection successful!');
  } catch (error) {
    console.error('❌ Failed to connect to Morph API:', error);
    process.exit(1);
  }
}

testConnection();