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
    terminalId: 'test-terminal-1',
    cols: 80,
    rows: 24,
    cwd: '/',
  });
});

managementSocket.on('worker:terminal-created', (data) => {
  console.log('Terminal created:', data);
  
  // Test sending input
  managementSocket.emit('worker:terminal-input', {
    terminalId: 'test-terminal-1',
    data: 'echo "Hello from worker!"\r',
  });
});

managementSocket.on('worker:terminal-output', (data) => {
  console.log('Terminal output:', data);
  
  // Exit after seeing output
  if (data.data.includes('Hello from worker!')) {
    console.log('Test successful!');
    setTimeout(() => {
      managementSocket.disconnect();
      clientSocket.disconnect();
      process.exit(0);
    }, 1000);
  }
});

managementSocket.on('worker:heartbeat', (data) => {
  console.log('Worker heartbeat:', data);
});

managementSocket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Also test client connection
const clientSocket = io('http://localhost:3002');

clientSocket.on('connect', () => {
  console.log('Connected to worker client port');
});

clientSocket.on('terminal-created', (data) => {
  console.log('Client: Terminal created:', data);
});

clientSocket.on('terminal-output', (data) => {
  console.log('Client: Terminal output:', data.data);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down test client...');
  managementSocket.disconnect();
  clientSocket.disconnect();
  process.exit(0);
});