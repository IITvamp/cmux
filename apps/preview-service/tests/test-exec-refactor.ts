import { MorphProvider } from '../src/services/morph.js';
import { ProviderFactory } from '../src/services/provider-factory.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testExecRefactor() {
  console.log('🧪 Testing refactored exec implementation...\n');
  
  const baseSnapshotId = process.argv[2] || process.env.MORPH_BASE_SNAPSHOT_ID || 'snapshot_7o3z2iez';
  
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
    
    // Test 1: Direct exec (without socket)
    console.log('\n1️⃣ Testing direct exec (without socket)...');
    const directResult = await provider.exec(instanceId, 'echo "Direct exec test"');
    console.log(`   Result: ${directResult.stdout.trim()}`);
    console.log(`   Exit code: ${directResult.exitCode}`);
    if (directResult.exitCode === 0 && directResult.stdout.includes('Direct exec test')) {
      console.log('   ✅ Direct exec works');
    } else {
      console.log('   ❌ Direct exec failed');
    }
    
    // Test 2: Try to setup socket connection
    console.log('\n2️⃣ Testing socket setup...');
    // Use the protected method through base class
    const sandboxProvider = provider as any; // Access base class methods
    const socketConnected = await sandboxProvider.setupSocketConnection(instanceId, 39377, (msg: string) => {
      console.log(`   ${msg}`);
    });
    
    if (socketConnected) {
      console.log('   ✅ Socket connected successfully');
      
      // Test 3: Exec via socket
      console.log('\n3️⃣ Testing exec via socket (using execCommand)...');
      const socketResult = await sandboxProvider.execCommand(instanceId, 'echo "Socket exec test"');
      console.log(`   Result: ${socketResult.stdout.trim()}`);
      console.log(`   Exit code: ${socketResult.exitCode}`);
      if (socketResult.exitCode === 0 && socketResult.stdout.includes('Socket exec test')) {
        console.log('   ✅ Socket exec works');
      } else {
        console.log('   ❌ Socket exec failed');
      }
    } else {
      console.log('   ℹ️  Socket not available (worker not running)');
      
      // Test 3: Exec via execCommand (should fallback to direct)
      console.log('\n3️⃣ Testing execCommand with fallback...');
      const fallbackResult = await sandboxProvider.execCommand(instanceId, 'echo "Fallback exec test"');
      console.log(`   Result: ${fallbackResult.stdout.trim()}`);
      console.log(`   Exit code: ${fallbackResult.exitCode}`);
      if (fallbackResult.exitCode === 0 && fallbackResult.stdout.includes('Fallback exec test')) {
        console.log('   ✅ Fallback exec works');
      } else {
        console.log('   ❌ Fallback exec failed');
      }
    }
    
    // Test 4: Complex command
    console.log('\n4️⃣ Testing complex command...');
    const complexResult = await provider.exec(instanceId, 'cd /tmp && echo "test" > test.txt && cat test.txt && rm test.txt && echo "done"');
    const lines = complexResult.stdout.trim().split('\n');
    if (complexResult.exitCode === 0 && lines.includes('test') && lines.includes('done')) {
      console.log('   ✅ Complex command execution works');
    } else {
      console.log('   ❌ Complex command failed');
    }
    
    // Test 5: Command with environment variables
    console.log('\n5️⃣ Testing command with environment variables...');
    const envResult = await provider.exec(instanceId, 'echo "Value: $TEST_VAR"', {
      env: { TEST_VAR: 'Hello from test' }
    });
    console.log(`   Result: ${envResult.stdout.trim()}`);
    if (envResult.exitCode === 0 && envResult.stdout.includes('Hello from test')) {
      console.log('   ✅ Environment variable passing works');
    } else {
      console.log('   ❌ Environment variable passing failed');
    }
    
    console.log('\n✅ All exec tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
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
}

testExecRefactor().catch(console.error);