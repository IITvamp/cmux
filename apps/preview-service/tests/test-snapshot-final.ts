import { MorphProvider } from '../src/services/morph.js';
import { ProviderFactory } from '../src/services/provider-factory.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testFinalSnapshot() {
  console.log('🧪 Testing final snapshot with streaming worker...\n');
  
  const baseSnapshotId = process.env.MORPH_BASE_SNAPSHOT_ID || 'snapshot_a4cbyac2';
  console.log(`Using snapshot: ${baseSnapshotId}\n`);
  
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
    console.log(`📦 Creating instance from snapshot ${baseSnapshotId}...`);
    const instance = await provider.createInstance({
      snapshotId: baseSnapshotId,
    });
    instanceId = instance.id;
    console.log(`✅ Instance created: ${instanceId}`);
    
    // Wait for instance
    console.log('⏳ Waiting for instance to be ready...');
    await provider.waitForInstance(instanceId);
    console.log('✅ Instance ready');
    
    // Test 1: Direct exec (baseline)
    console.log('\n1️⃣ Testing direct exec...');
    const directResult = await provider.exec(instanceId, 'echo "Hello from direct exec"');
    console.log(`   Result: ${directResult.stdout.trim()}`);
    console.log(`   Exit code: ${directResult.exitCode}`);
    
    // Test 2: Socket-based exec with streaming
    console.log('\n2️⃣ Testing streaming exec via socket...');
    const logs: string[] = [];
    const streamResult = await provider.execCommand(instanceId, 
      'for i in 1 2 3; do echo "Line $i"; sleep 1; done',
      { logHandler: (msg) => logs.push(msg) }
    );
    console.log(`   Streamed ${logs.length} log messages`);
    console.log(`   Final output: ${streamResult.stdout.trim()}`);
    console.log(`   Exit code: ${streamResult.exitCode}`);
    
    // Test 3: Create preview environment
    console.log('\n3️⃣ Testing preview environment creation...');
    const previewEnv = await provider.createPreviewEnvironment({
      baseSnapshotId,
      config: {
        gitUrl: 'https://github.com/octocat/Hello-World.git',
        branch: 'master',
        hasDevcontainer: false,
      },
      logHandler: (msg) => console.log(`   ${msg}`)
    });
    console.log(`   ✅ Preview environment created: ${previewEnv.id}`);
    console.log(`   VSCode URL: ${previewEnv.urls.vscode}`);
    console.log(`   Worker URL: ${previewEnv.urls.worker}`);
    
    // Clean up preview environment
    await provider.stopInstance(previewEnv.id);
    console.log('   ✅ Preview environment stopped');
    
    console.log('\n✅ All tests passed! Snapshot is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (instanceId && provider) {
      console.log('\n🧹 Cleaning up test instance...');
      try {
        await provider.stopInstance(instanceId);
        console.log('✅ Test instance stopped');
      } catch (error) {
        console.error('⚠️  Could not stop instance:', error);
      }
    }
  }
}

testFinalSnapshot().catch(console.error);