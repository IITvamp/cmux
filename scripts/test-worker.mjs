import { io } from 'socket.io-client';
import { execSync, spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

const CONTAINER_NAME = 'coderouter-worker-test';
const IMAGE_NAME = 'coderouter-worker';

// Build and run Docker container
async function setupDockerContainer() {
  console.log('\n=== DOCKER SETUP ===');
  console.log(`Building Docker image: ${IMAGE_NAME}...`);
  console.log('This may take a few minutes on first run...');
  
  try {
    execSync(`docker build --platform=linux/amd64 -t ${IMAGE_NAME} .`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`\n✓ Docker image '${IMAGE_NAME}' built successfully`);
  } catch (error) {
    console.error('\n✗ Failed to build Docker image:', error);
    process.exit(1);
  }

  // Stop and remove any existing container
  console.log('\nCleaning up any existing containers...');
  try {
    execSync(`docker stop ${CONTAINER_NAME} 2>/dev/null || true`);
    execSync(`docker rm ${CONTAINER_NAME} 2>/dev/null || true`);
    console.log('✓ Cleanup complete');
  } catch (error) {
    // Ignore errors if container doesn't exist
  }

  console.log(`\nStarting Docker container: ${CONTAINER_NAME}`);
  console.log('Container configuration:');
  console.log('  - Port 3002: Worker client port');
  console.log('  - Port 3003: Worker management port');
  console.log('  - Privileged mode: Enabled (for Docker-in-Docker)');
  
  const dockerRun = spawn('docker', [
    'run',
    '--rm',
    '--name', CONTAINER_NAME,
    '--privileged',
    '-p', '3002:3002',
    '-p', '3003:3003',
    '-e', 'NODE_ENV=production',
    '-e', 'WORKER_PORT=3002',
    '-e', 'MANAGEMENT_PORT=3003',
    IMAGE_NAME
  ], {
    stdio: 'inherit'
  });

  dockerRun.on('error', (error) => {
    console.error('\n✗ Failed to start Docker container:', error);
    process.exit(1);
  });

  // Wait for container to be ready
  console.log('\nWaiting for container to be ready...');
  console.log('Docker-in-Docker can take 20-30 seconds to initialize...');
  
  // Wait longer for Docker-in-Docker to start
  for (let i = 30; i > 0; i -= 5) {
    console.log(`  ${i} seconds remaining...`);
    await delay(5000);
    
    // Check if container is still running
    try {
      const containerCheck = execSync(`docker ps | grep ${CONTAINER_NAME}`, { encoding: 'utf8' });
      if (!containerCheck) {
        console.error('\n✗ Container stopped unexpectedly');
        console.log('\nChecking container logs:');
        try {
          const logs = execSync(`docker logs ${CONTAINER_NAME} --tail 50`, { encoding: 'utf8' });
          console.log(logs);
        } catch (e) {
          console.error('Could not get container logs');
        }
        process.exit(1);
      }
    } catch (e) {
      // Container might not be listed yet, continue waiting
    }
  }
  console.log('\n✓ Container should be ready\n');

  return dockerRun;
}

// Test socket connections
async function testWorker() {
  let testTimeout;
  
  // Set overall test timeout
  testTimeout = setTimeout(() => {
    console.error('\n❌ Test timed out after 60 seconds');
    console.log('\nChecking container status and logs...');
    try {
      execSync(`docker logs ${CONTAINER_NAME} --tail 100`, { stdio: 'inherit' });
    } catch (e) {}
    cleanup();
  }, 60000);
  
  const clearTestTimeout = () => {
    if (testTimeout) {
      clearTimeout(testTimeout);
      testTimeout = null;
    }
  };
  
  console.log('=== SOCKET CONNECTION TEST ===\n');
  
  // Connect to worker management port
  console.log('Connecting to worker management port (3003)...');
  const managementSocket = io('http://localhost:3003', {
    timeout: 10000,
    reconnectionAttempts: 3
  });

  managementSocket.on('connect', () => {
    console.log('✓ Connected to worker management port');
  });
  
  managementSocket.on('connect_error', (error) => {
    console.error('\n❌ Failed to connect to management port:', error.message);
    console.log('\nTip: Check if the worker is running properly with: docker logs ' + CONTAINER_NAME);
  });

  managementSocket.on('worker:register', (data) => {
    console.log('\n✓ Worker registered with ID:', data.workerId);
    console.log('  Capabilities:', data.capabilities);
    
    // Test creating a terminal
    console.log('\nCreating test terminal...');
    console.log('  Terminal ID: test-terminal-1');
    console.log('  Size: 80x24');
    console.log('  Working directory: /');
    
    managementSocket.emit('worker:create-terminal', {
      terminalId: 'test-terminal-1',
      cols: 80,
      rows: 24,
      cwd: '/',
    });
  });

  managementSocket.on('worker:terminal-created', (data) => {
    console.log('\n✓ Terminal created successfully');
    console.log('  Terminal ID:', data.terminalId);
    
    // Test sending input
    const testCommand = 'echo "Hello from worker!"';
    console.log(`\nSending test command: ${testCommand}`);
    
    managementSocket.emit('worker:terminal-input', {
      terminalId: 'test-terminal-1',
      data: testCommand + '\r',
    });
  });

  managementSocket.on('worker:terminal-output', (data) => {
    console.log('\n📤 Terminal output received:');
    console.log('  Raw data:', JSON.stringify(data.data));
    console.log('  Decoded:', data.data);
    
    // Exit after seeing output
    if (data.data.includes('Hello from worker!')) {
      console.log('\n✅ TEST SUCCESSFUL! Worker responded correctly.');
      console.log('\nCleaning up in 1 second...');
      clearTestTimeout();
      setTimeout(() => {
        managementSocket.disconnect();
        clientSocket.disconnect();
        cleanup();
      }, 1000);
    }
  });

  managementSocket.on('worker:heartbeat', (data) => {
    console.log('💓 Worker heartbeat:', new Date(data.timestamp).toISOString());
  });

  managementSocket.on('error', (error) => {
    console.error('\n❌ Management socket error:', error);
  });

  // Also test client connection
  console.log('\nConnecting to worker client port (3002)...');
  const clientSocket = io('http://localhost:3002', {
    timeout: 10000,
    reconnectionAttempts: 3
  });

  clientSocket.on('connect', () => {
    console.log('✓ Connected to worker client port');
  });
  
  clientSocket.on('connect_error', (error) => {
    console.error('\n❌ Failed to connect to client port:', error.message);
  });

  clientSocket.on('terminal-created', (data) => {
    console.log('\n📱 Client notification: Terminal created');
    console.log('  Details:', data);
  });

  clientSocket.on('terminal-output', (data) => {
    console.log('\n📱 Client notification: Terminal output');
    console.log('  Output:', data.data);
  });
  
  clientSocket.on('error', (error) => {
    console.error('\n❌ Client socket error:', error);
  });
}

let dockerProcess;

// Cleanup function
function cleanup() {
  console.log('\n=== CLEANUP ===');
  console.log('Stopping Docker container...');
  try {
    execSync(`docker stop ${CONTAINER_NAME}`);
    console.log('✓ Container stopped');
  } catch (error) {
    console.log('Container already stopped or not running');
  }
  console.log('\n👋 Test complete!\n');
  process.exit(0);
}

// Graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Main execution
(async () => {
  console.log('\n🚀 CODEROUTER WORKER TEST');
  console.log('========================\n');
  console.log('This test will:');
  console.log('1. Build the Docker image');
  console.log('2. Start a worker container');
  console.log('3. Connect via Socket.IO');
  console.log('4. Create a terminal');
  console.log('5. Execute a test command');
  console.log('6. Verify the output\n');
  
  try {
    dockerProcess = await setupDockerContainer();
    await testWorker();
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    cleanup();
  }
})();