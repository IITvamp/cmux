import { MorphProvider } from '../src/services/morph.js';
import { ProviderFactory } from '../src/services/provider-factory.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function debugWorkerConnection() {
  console.log('🔍 Debugging worker connection issue...');
  
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
    
    // Create instance from base snapshot
    console.log(`📦 Creating instance from snapshot ${baseSnapshotId}...`);
    const instance = await provider.createInstance({
      snapshotId: baseSnapshotId,
    });
    instanceId = instance.id;
    console.log(`✅ Instance created: ${instanceId}`);
    
    // Check services
    console.log('\n📡 Services available:');
    instance.services.forEach(service => {
      console.log(`  - ${service.name}: port ${service.port} -> ${service.url}`);
    });
    
    // Check specifically for worker service
    const workerService = instance.services.find(s => s.port === 39377);
    const vscodeService = instance.services.find(s => s.port === 39378);
    
    console.log('\n🔍 Service analysis:');
    console.log(`  VSCode service (39378): ${vscodeService ? '✅ Found' : '❌ Not found'}`);
    console.log(`  Worker service (39377): ${workerService ? '✅ Found' : '❌ Not found'}`);
    
    if (workerService) {
      console.log(`  Worker URL: ${workerService.url}`);
      
      // Try to connect to worker
      console.log('\n🔌 Testing worker connection...');
      try {
        // Test basic HTTP connection first
        const response = await fetch(`${workerService.url}/socket.io/?EIO=4&transport=polling`);
        console.log(`  HTTP test: ${response.ok ? '✅ OK' : `❌ Failed (${response.status})`}`);
        
        if (response.ok) {
          const text = await response.text();
          console.log(`  Response preview: ${text.substring(0, 100)}...`);
        }
      } catch (error) {
        console.log(`  ❌ HTTP connection failed: ${error}`);
      }
      
      // Check if worker process is running
      console.log('\n🔍 Checking worker process...');
      const psResult = await provider.exec(instanceId, 'ps aux | grep -E "(worker|39377)" | grep -v grep');
      console.log('  Process check:');
      if (psResult.stdout) {
        console.log(psResult.stdout.split('\n').map(line => `    ${line}`).join('\n'));
      } else {
        console.log('    No worker process found');
      }
      
      // Check if port is listening
      const netstatResult = await provider.exec(instanceId, 'netstat -tlnp 2>/dev/null | grep 39377 || ss -tlnp | grep 39377');
      console.log('\n  Port 39377 status:');
      if (netstatResult.stdout) {
        console.log(`    ${netstatResult.stdout}`);
      } else {
        console.log('    Port not listening');
      }
    } else {
      console.log('\n⚠️  Worker service not found in instance services');
      console.log('  This suggests the base snapshot may not have the worker configured');
      
      // Check what's in the snapshot
      console.log('\n🔍 Checking snapshot contents...');
      const lsResult = await provider.exec(instanceId, 'ls -la /root/');
      console.log('  /root/ contents:');
      console.log(lsResult.stdout.split('\n').slice(0, 10).map(line => `    ${line}`).join('\n'));
      
      // Check for worker files
      const workerCheck = await provider.exec(instanceId, 'find /root -name "*worker*" -type f 2>/dev/null | head -5');
      console.log('\n  Worker-related files:');
      if (workerCheck.stdout) {
        console.log(workerCheck.stdout.split('\n').map(line => `    ${line}`).join('\n'));
      } else {
        console.log('    No worker files found');
      }
    }
    
    // Check if we need to start the worker manually
    console.log('\n🚀 Attempting to start worker manually...');
    const startWorkerResult = await provider.exec(instanceId, `
      cd /root/workspace 2>/dev/null || cd /root 2>/dev/null
      if [ -f "worker.js" ]; then
        nohup node worker.js > /tmp/worker.log 2>&1 &
        echo "Started worker.js"
      elif [ -f "streaming-worker.cjs" ]; then
        nohup node streaming-worker.cjs > /tmp/worker.log 2>&1 &
        echo "Started streaming-worker.cjs"
      elif [ -d "apps/preview-service" ]; then
        cd apps/preview-service
        if [ -f "src/worker/streaming-worker.cjs" ]; then
          PORT=39377 nohup node src/worker/streaming-worker.cjs > /tmp/worker.log 2>&1 &
          echo "Started preview-service worker"
        else
          echo "No worker file found in preview-service"
        fi
      else
        echo "No worker file found"
      fi
    `);
    console.log(`  Result: ${startWorkerResult.stdout.trim()}`);
    
    if (startWorkerResult.stdout.includes('Started')) {
      // Wait a moment for worker to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if it's running now
      const psAfter = await provider.exec(instanceId, 'ps aux | grep -E "(worker|39377)" | grep -v grep');
      console.log('\n  Worker process after start attempt:');
      if (psAfter.stdout) {
        console.log(psAfter.stdout.split('\n').map(line => `    ${line}`).join('\n'));
      } else {
        console.log('    Still no worker process');
      }
      
      // Check logs
      const logsResult = await provider.exec(instanceId, 'tail -20 /tmp/worker.log 2>/dev/null');
      if (logsResult.stdout) {
        console.log('\n  Worker logs:');
        console.log(logsResult.stdout.split('\n').map(line => `    ${line}`).join('\n'));
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
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

debugWorkerConnection().catch(console.error);