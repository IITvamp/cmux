import { MorphProvider } from '../src/services/morph.js';
import { ProviderFactory } from '../src/services/provider-factory.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function verifyContainerHealth() {
  console.log('🏥 Verifying container health and functionality...\n');
  
  const baseSnapshotId = process.env.MORPH_BASE_SNAPSHOT_ID || 'snapshot_7o3z2iez';
  
  if (!process.env.MORPH_API_KEY) {
    console.error('❌ MORPH_API_KEY not found in environment');
    process.exit(1);
  }
  
  let provider: MorphProvider | null = null;
  let instanceId: string | null = null;
  let allTestsPassed = true;
  
  try {
    // Get provider
    provider = await ProviderFactory.getProvider({ type: 'morph' }) as MorphProvider;
    console.log('✅ Provider created');
    
    // Create instance from base snapshot
    console.log(`\n📦 Creating instance from snapshot ${baseSnapshotId}...`);
    const instance = await provider.createInstance({
      snapshotId: baseSnapshotId,
    });
    instanceId = instance.id;
    console.log(`✅ Instance created: ${instanceId}`);
    
    // Wait for instance to be ready
    console.log('\n⏳ Waiting for instance to be ready...');
    await provider.waitForInstance(instanceId);
    console.log('✅ Instance ready');
    
    // Test suite
    console.log('\n🧪 Running health checks...\n');
    
    // 1. Basic exec test
    console.log('1️⃣ Testing basic command execution...');
    const echoResult = await provider.exec(instanceId, 'echo "Hello from container"');
    if (echoResult.exitCode === 0 && echoResult.stdout.includes('Hello from container')) {
      console.log('   ✅ Basic exec works');
    } else {
      console.log('   ❌ Basic exec failed');
      console.log(`      Exit code: ${echoResult.exitCode}`);
      console.log(`      Stdout: ${echoResult.stdout}`);
      console.log(`      Stderr: ${echoResult.stderr}`);
      allTestsPassed = false;
    }
    
    // 2. Check system basics
    console.log('\n2️⃣ Checking system basics...');
    const unameResult = await provider.exec(instanceId, 'uname -a');
    const whoamiResult = await provider.exec(instanceId, 'whoami');
    const pwdResult = await provider.exec(instanceId, 'pwd');
    
    console.log(`   OS: ${unameResult.stdout.trim()}`);
    console.log(`   User: ${whoamiResult.stdout.trim()}`);
    console.log(`   Working dir: ${pwdResult.stdout.trim()}`);
    
    if (unameResult.exitCode === 0 && whoamiResult.exitCode === 0) {
      console.log('   ✅ System commands work');
    } else {
      console.log('   ❌ System commands failed');
      allTestsPassed = false;
    }
    
    // 3. Check essential tools
    console.log('\n3️⃣ Checking essential development tools...');
    const tools = [
      { name: 'Git', cmd: 'git --version' },
      { name: 'Node.js', cmd: 'node --version' },
      { name: 'npm', cmd: 'npm --version' },
      { name: 'Python', cmd: 'python3 --version || python --version' },
      { name: 'curl', cmd: 'curl --version | head -1' },
    ];
    
    for (const tool of tools) {
      const result = await provider.exec(instanceId, tool.cmd);
      if (result.exitCode === 0) {
        const version = result.stdout.trim().split('\n')[0];
        console.log(`   ✅ ${tool.name}: ${version}`);
      } else {
        console.log(`   ❌ ${tool.name}: Not found or error`);
        allTestsPassed = false;
      }
    }
    
    // 4. Check file system operations
    console.log('\n4️⃣ Testing file system operations...');
    const testDir = '/tmp/test_' + Date.now();
    const mkdirResult = await provider.exec(instanceId, `mkdir -p ${testDir}`);
    const writeResult = await provider.exec(instanceId, `echo "test content" > ${testDir}/test.txt`);
    const readResult = await provider.exec(instanceId, `cat ${testDir}/test.txt`);
    const cleanupResult = await provider.exec(instanceId, `rm -rf ${testDir}`);
    
    if (mkdirResult.exitCode === 0 && 
        writeResult.exitCode === 0 && 
        readResult.stdout.includes('test content') &&
        cleanupResult.exitCode === 0) {
      console.log('   ✅ File system operations work');
    } else {
      console.log('   ❌ File system operations failed');
      allTestsPassed = false;
    }
    
    // 5. Check network connectivity
    console.log('\n5️⃣ Testing network connectivity...');
    const pingResult = await provider.exec(instanceId, 'curl -s -o /dev/null -w "%{http_code}" https://api.github.com');
    if (pingResult.stdout.trim() === '200') {
      console.log('   ✅ Network connectivity works (GitHub API reachable)');
    } else {
      console.log(`   ⚠️  Network test returned: ${pingResult.stdout.trim()}`);
    }
    
    // 6. Check services
    console.log('\n6️⃣ Checking exposed services...');
    console.log(`   Services count: ${instance.services.length}`);
    for (const service of instance.services) {
      console.log(`   - ${service.name} (port ${service.port}): ${service.url}`);
      
      // Test if service is accessible
      try {
        const response = await fetch(service.url);
        console.log(`     → HTTP ${response.status} ${response.statusText}`);
      } catch (error) {
        console.log(`     → Connection failed: ${error}`);
      }
    }
    
    // 7. Check VSCode server
    console.log('\n7️⃣ Checking VSCode server...');
    const vscodeService = instance.services.find(s => s.port === 39378);
    if (vscodeService) {
      console.log(`   ✅ VSCode service found at ${vscodeService.url}`);
      
      // Check if openvscode-server is installed
      const vscodeCheck = await provider.exec(instanceId, 'which openvscode-server || which code-server || echo "not found"');
      console.log(`   VSCode binary: ${vscodeCheck.stdout.trim()}`);
      
      // Check if it's running
      const vscodeProcess = await provider.exec(instanceId, 'ps aux | grep -E "openvscode|code-server" | grep -v grep');
      if (vscodeProcess.stdout) {
        console.log('   ✅ VSCode server process is running');
      } else {
        console.log('   ⚠️  VSCode server process not found');
      }
    } else {
      console.log('   ❌ VSCode service not exposed');
      allTestsPassed = false;
    }
    
    // 8. Check worker service
    console.log('\n8️⃣ Checking worker service...');
    const workerService = instance.services.find(s => s.port === 39377);
    if (workerService) {
      console.log(`   ✅ Worker service exposed at ${workerService.url}`);
      
      // Check if worker is actually running
      const workerProcess = await provider.exec(instanceId, 'ps aux | grep 39377 | grep -v grep');
      const portListen = await provider.exec(instanceId, 'netstat -tlnp 2>/dev/null | grep 39377 || ss -tlnp 2>/dev/null | grep 39377 || lsof -i :39377 2>/dev/null');
      
      if (workerProcess.stdout || portListen.stdout) {
        console.log('   ✅ Worker process is running on port 39377');
        console.log(`   Process: ${workerProcess.stdout.trim() || 'Not visible in ps'}`);
        console.log(`   Port: ${portListen.stdout.trim() || 'Not visible in netstat'}`);
      } else {
        console.log('   ⚠️  Worker service exposed but no process listening on port 39377');
        console.log('   This is why socket connection fails!');
        
        // Try to find worker files
        console.log('\n   Looking for worker files...');
        const findWorker = await provider.exec(instanceId, 'find / -name "*worker*.js" -o -name "*worker*.cjs" 2>/dev/null | head -10');
        if (findWorker.stdout) {
          console.log('   Worker files found:');
          findWorker.stdout.split('\n').filter(Boolean).forEach(file => {
            console.log(`     - ${file}`);
          });
        } else {
          console.log('   No worker files found in the snapshot');
        }
      }
    } else {
      console.log('   ⚠️  Worker service not exposed (expected on port 39377)');
    }
    
    // 9. Test git clone capability
    console.log('\n9️⃣ Testing git clone capability...');
    const testRepo = 'https://github.com/microsoft/vscode-remote-try-node';
    const cloneResult = await provider.exec(instanceId, `cd /tmp && git clone --depth 1 ${testRepo} test-repo 2>&1`);
    if (cloneResult.exitCode === 0) {
      console.log('   ✅ Git clone works');
      // Clean up
      await provider.exec(instanceId, 'rm -rf /tmp/test-repo');
    } else {
      console.log('   ❌ Git clone failed');
      console.log(`   Error: ${cloneResult.stderr || cloneResult.stdout}`);
      allTestsPassed = false;
    }
    
    // 10. Check memory and disk
    console.log('\n🔟 Checking resources...');
    const memResult = await provider.exec(instanceId, 'free -h | grep Mem');
    const diskResult = await provider.exec(instanceId, 'df -h / | tail -1');
    console.log(`   Memory: ${memResult.stdout.trim()}`);
    console.log(`   Disk: ${diskResult.stdout.trim()}`);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 HEALTH CHECK SUMMARY');
    console.log('='.repeat(60));
    
    if (allTestsPassed) {
      console.log('✅ All critical tests passed!');
      console.log('   The container is healthy and functional.');
    } else {
      console.log('⚠️  Some tests failed!');
      console.log('   The container may need fixes or a new base snapshot.');
    }
    
    const workerProcessResult = await provider.exec(instanceId, 'ps aux | grep 39377 | grep -v grep');
    if (!workerService || !workerProcessResult.stdout) {
      console.log('\n⚠️  WORKER SERVICE ISSUE DETECTED:');
      console.log('   The worker service is exposed but not running.');
      console.log('   This causes the socket connection timeout.');
      console.log('   Solutions:');
      console.log('   1. Create a new base snapshot with worker running');
      console.log('   2. Start worker manually after instance creation');
      console.log('   3. Make worker optional for non-streaming operations');
    }
    
  } catch (error) {
    console.error('\n❌ Health check failed:', error);
    allTestsPassed = false;
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
  
  process.exit(allTestsPassed ? 0 : 1);
}

verifyContainerHealth().catch(console.error);