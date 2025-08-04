const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Worker is running');
});

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('exec', async (data) => {
    const { requestId, command, options = {} } = data;
    
    console.log(`Executing command [${requestId}]: ${command}`);
    
    try {
      // Spawn the process using shell
      const proc = spawn(command, {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      // Stream stdout
      proc.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        socket.emit('exec:output', { requestId, stdout: output });
      });

      // Stream stderr
      proc.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        socket.emit('exec:output', { requestId, stderr: output });
      });

      // Handle process completion
      proc.on('close', (code) => {
        console.log(`Command [${requestId}] exited with code ${code}`);
        socket.emit('exec:complete', {
          requestId,
          exitCode: code || 0,
          stdout,
          stderr,
        });
      });

      // Handle errors
      proc.on('error', (error) => {
        console.error(`Command [${requestId}] error:`, error);
        socket.emit('exec:error', {
          requestId,
          error: error.message,
        });
      });

    } catch (error) {
      console.error(`Failed to execute command [${requestId}]:`, error);
      socket.emit('exec:error', {
        requestId,
        error: error.message,
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.WORKER_PORT || 39377;
server.listen(PORT, () => {
  console.log(`Worker listening on port ${PORT}`);
});