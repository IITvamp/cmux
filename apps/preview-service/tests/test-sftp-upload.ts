import { MorphProvider } from '../src/services/morph.js';
import { ProviderFactory } from '../src/services/provider-factory.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testSFTPUpload() {
  console.log('🔧 Testing SFTP file upload...');
  
  const baseSnapshotId = process.env.MORPH_BASE_SNAPSHOT_ID || 'snapshot_7o3z2iez';
  
  if (!process.env.MORPH_API_KEY) {
    console.error('❌ MORPH_API_KEY not found in environment');
    process.exit(1);
  }
  
  let provider: MorphProvider | null = null;
  let instanceId: string | null = null;
  
  try {
    // Get provider
    provider = await ProviderFactory.getProvider({ type: 'morph' }) as MorphProvider;
    console.log('✅ Provider created');
    
    // Create instance
    console.log('📦 Creating instance from snapshot...');
    const instance = await provider.createInstance({
      snapshotId: baseSnapshotId,
    });
    instanceId = instance.id;
    console.log(`✅ Instance created: ${instanceId}`);
    
    // Wait for instance
    console.log('⏳ Waiting for instance to be ready...');
    await provider.waitForInstance(instanceId);
    console.log('✅ Instance ready');
    
    // Test file upload
    console.log('📤 Testing SFTP file upload...');
    const testContent = 'Hello from SFTP upload test!\nThis is line 2.\nThis is line 3.';
    const remotePath = '/tmp/sftp-test.txt';
    
    console.log(`  Uploading to ${remotePath}...`);
    await provider.uploadFile(instanceId, testContent, remotePath);
    console.log('✅ File uploaded successfully');
    
    // Verify upload
    console.log('🔍 Verifying uploaded file...');
    const result = await provider.exec(instanceId, `cat ${remotePath}`);
    
    if (result.exitCode === 0) {
      console.log('✅ File content verified:');
      console.log('---');
      console.log(result.stdout);
      console.log('---');
      
      if (result.stdout.trim() === testContent) {
        console.log('✅ Content matches exactly!');
      } else {
        console.log('⚠️  Content differs from expected');
        console.log('Expected:');
        console.log(testContent);
      }
    } else {
      console.error('❌ Failed to read file:', result.stderr);
    }
    
    // Test nested directory upload
    console.log('\n📤 Testing nested directory upload...');
    const nestedPath = '/tmp/nested/dir/sftp-nested.txt';
    await provider.uploadFile(instanceId, 'Nested file content', nestedPath);
    console.log('✅ Nested file uploaded');
    
    const nestedResult = await provider.exec(instanceId, `cat ${nestedPath}`);
    if (nestedResult.exitCode === 0) {
      console.log('✅ Nested file verified');
    } else {
      console.error('❌ Failed to read nested file');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (instanceId && provider) {
      console.log('\n🧹 Cleaning up...');
      try {
        await provider.stopInstance(instanceId);
        console.log('✅ Instance stopped');
      } catch (error) {
        console.error('⚠️  Could not stop instance:', error);
      }
    }
  }
  
  console.log('\n✅ All tests passed!');
}

testSFTPUpload().catch(console.error);