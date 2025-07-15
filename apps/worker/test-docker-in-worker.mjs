import { io } from 'socket.io-client';

// Connect to worker management port
const managementSocket = io('http://localhost:3003');

managementSocket.on('connect', () => {
  console.log('Connected to worker management port');
});

managementSocket.on('worker:register', (data) => {
  console.log('Worker registered:', data);
  
  // Test creating a terminal
  managementSocket.emit('worker:create-terminal', {
    terminalId: 'docker-test-terminal',
    cols: 80,
    rows: 24,
    cwd: '/',
  });
});

managementSocket.on('worker:terminal-created', (data) => {
  console.log('Terminal created:', data);
  
  // Test docker command
  managementSocket.emit('worker:terminal-input', {
    terminalId: 'docker-test-terminal',
    data: 'docker version\r',
  });
  
  // Also test devcontainer CLI
  setTimeout(() => {
    managementSocket.emit('worker:terminal-input', {
      terminalId: 'docker-test-terminal',
      data: 'devcontainer --version\r',
    });
  }, 2000);
});

let outputBuffer = '';
managementSocket.on('worker:terminal-output', (data) => {
  console.log('Terminal output:', data.data);
  outputBuffer += data.data;
  
  // Exit after seeing both outputs
  if (outputBuffer.includes('Docker Engine') && outputBuffer.includes('0.80')) {
    console.log('\nTest successful! Both Docker and devcontainer CLI are working.');
    setTimeout(() => {
      managementSocket.disconnect();
      process.exit(0);
    }, 1000);
  }
});

managementSocket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down test client...');
  managementSocket.disconnect();
  process.exit(0);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('Test timed out');
  process.exit(1);
}, 30000);