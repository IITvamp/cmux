import { Server } from 'socket.io';
import { spawn } from 'node-pty';
import { createServer } from 'http';
import { platform } from 'os';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const terminals = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create-terminal', ({ cols, rows }) => {
    const shell = platform() === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = spawn(shell, [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: process.env.HOME,
      env: process.env
    });

    terminals.set(socket.id, ptyProcess);

    ptyProcess.onData((data) => {
      socket.emit('terminal-output', data);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`Terminal exited with code ${exitCode} and signal ${signal}`);
      socket.emit('terminal-exit', { exitCode, signal });
      terminals.delete(socket.id);
    });

    console.log(`Terminal created for ${socket.id}`);
  });

  socket.on('terminal-input', (data) => {
    const ptyProcess = terminals.get(socket.id);
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });

  socket.on('resize', ({ cols, rows }) => {
    const ptyProcess = terminals.get(socket.id);
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const ptyProcess = terminals.get(socket.id);
    if (ptyProcess) {
      ptyProcess.kill();
      terminals.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Terminal server listening on port ${PORT}`);
});