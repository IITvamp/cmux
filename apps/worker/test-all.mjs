import { io } from 'socket.io-client';

console.log('=== Testing Worker Container ===\n');

// Connect to worker management port
const managementSocket = io('http://localhost:3003');
const clientSocket = io('http://localhost:3002');

let testsPassed = 0;
const totalTests = 3;

managementSocket.on('connect', () => {
  console.log('✓ Connected to worker management port');
  testsPassed++;
});

clientSocket.on('connect', () => {
  console.log('✓ Connected to worker client port');  
  testsPassed++;
});

managementSocket.on('worker:register', (data) => {
  console.log('\n✓ Worker registered with capabilities:');
  console.log(`  - Worker ID: ${data.workerId}`);
  console.log(`  - Max terminals: ${data.capabilities.maxConcurrentTerminals}`);
  console.log(`  - Memory: ${data.capabilities.memoryMB} MB`);
  console.log(`  - CPU cores: ${data.capabilities.cpuCores}`);
  console.log(`  - Platform: ${data.containerInfo.platform}`);
  
  // Create a test terminal
  const terminalId = `test-${Date.now()}`;
  managementSocket.emit('worker:create-terminal', {
    terminalId,
    cols: 80,
    rows: 24,
    cwd: '/',
  });
  
  managementSocket.once('worker:terminal-created', (data) => {
    console.log(`\n✓ Terminal created: ${data.terminalId}`);
    
    // Test Docker
    managementSocket.emit('worker:terminal-input', {
      terminalId,
      data: 'docker --version && devcontainer --version && echo "ALL_TESTS_PASSED"\r',
    });
  });
  
  let outputBuffer = '';
  managementSocket.on('worker:terminal-output', (data) => {
    if (data.terminalId === terminalId) {
      outputBuffer += data.data;
      
      if (outputBuffer.includes('ALL_TESTS_PASSED')) {
        console.log('\n✓ Docker and devcontainer CLI are working!');
        testsPassed++;
        
        console.log(`\n=== Test Results: ${testsPassed}/${totalTests} passed ===`);
        
        // Clean up
        managementSocket.emit('worker:close-terminal', { terminalId });
        managementSocket.disconnect();
        clientSocket.disconnect();
        
        process.exit(testsPassed === totalTests ? 0 : 1);
      }
    }
  });
});

// Timeout
setTimeout(() => {
  console.log('\n✗ Test timed out');
  console.log(`\n=== Test Results: ${testsPassed}/${totalTests} passed ===`);
  process.exit(1);
}, 15000);