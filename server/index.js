import { randomUUID } from 'crypto';
import { createServer } from 'http';
import { spawn } from 'node-pty';
import { platform } from 'os';
import { Server } from 'socket.io';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const clientTerminals = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  clientTerminals.set(socket.id, new Map());

  socket.on('create-terminal', ({ cols, rows }) => {
    const terminalId = randomUUID();
    const shell = platform() === 'win32' ? 'powershell.exe' : 'zsh';
    const ptyProcess = spawn(shell, [], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: process.env.HOME,
      env: process.env
    });

    const terminals = clientTerminals.get(socket.id);
    terminals.set(terminalId, ptyProcess);

    ptyProcess.onData((data) => {
      socket.emit('terminal-output', { terminalId, data });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`Terminal ${terminalId} exited with code ${exitCode} and signal ${signal}`);
      socket.emit('terminal-exit', { terminalId, exitCode, signal });
      terminals.delete(terminalId);
    });

    socket.emit('terminal-created', { terminalId });
    console.log(`Terminal ${terminalId} created for ${socket.id}`);
  });

  socket.on('terminal-input', ({ terminalId, data }) => {
    const terminals = clientTerminals.get(socket.id);
    if (terminals) {
      const ptyProcess = terminals.get(terminalId);
      if (ptyProcess) {
        ptyProcess.write(data);
      }
    }
  });

  socket.on('resize', ({ terminalId, cols, rows }) => {
    const terminals = clientTerminals.get(socket.id);
    if (terminals) {
      const ptyProcess = terminals.get(terminalId);
      if (ptyProcess) {
        ptyProcess.resize(cols, rows);
      }
    }
  });

  socket.on('close-terminal', ({ terminalId }) => {
    const terminals = clientTerminals.get(socket.id);
    if (terminals) {
      const ptyProcess = terminals.get(terminalId);
      if (ptyProcess) {
        ptyProcess.kill();
        terminals.delete(terminalId);
        console.log(`Terminal ${terminalId} closed`);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const terminals = clientTerminals.get(socket.id);
    if (terminals) {
      terminals.forEach((ptyProcess) => {
        ptyProcess.kill();
      });
      clientTerminals.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Terminal server listening on port ${PORT}`);
});