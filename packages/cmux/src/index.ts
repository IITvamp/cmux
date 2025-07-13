import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

export interface CmuxOptions {
  port?: number;
  staticDir?: string;
  corsOrigin?: string | string[] | boolean;
}

export function createCmuxServer(options: CmuxOptions = {}) {
  const {
    port = 2689,
    staticDir = path.join(process.cwd(), 'public'),
    corsOrigin = true
  } = options;

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST']
    }
  });

  app.use(cors({
    origin: corsOrigin
  }));

  app.use(express.static(staticDir));

  app.get('*', (req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    socket.on('message', (data) => {
      console.log('Message received:', data);
      socket.emit('message', { echo: data });
    });
  });

  const start = () => {
    return new Promise<void>((resolve) => {
      httpServer.listen(port, () => {
        console.log(`Cmux server running on port ${port}`);
        console.log(`Serving static files from: ${staticDir}`);
        resolve();
      });
    });
  };

  const stop = () => {
    return new Promise<void>((resolve) => {
      httpServer.close(() => {
        console.log('Cmux server stopped');
        resolve();
      });
    });
  };

  return {
    app,
    io,
    httpServer,
    start,
    stop
  };
}

export function startServer(options?: CmuxOptions) {
  const server = createCmuxServer(options);
  server.start();
  return server;
}