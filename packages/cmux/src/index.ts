import cors from "cors";
import type { Express } from "express";
import express from "express";
import type { Server as HttpServer } from "http";
import { createServer } from "http";
import path from "path";
import { Server } from "socket.io";

export interface CmuxOptions {
  port?: number;
  staticDir?: string;
  corsOrigin?: string | string[] | boolean;
}

export interface CmuxServer {
  app: Express;
  io: Server;
  httpServer: HttpServer;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createCmuxServer(options: CmuxOptions = {}): CmuxServer {
  const {
    port = 2689,
    staticDir = path.join(process.cwd(), "public"),
    corsOrigin = true,
  } = options;

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  app.use(
    cors({
      origin: corsOrigin,
    })
  );

  app.use(express.static(staticDir));

  app.get("*", (req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });

    socket.on("message", (data) => {
      console.log("Message received:", data);
      socket.emit("message", { echo: data });
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
        console.log("Cmux server stopped");
        resolve();
      });
    });
  };

  return {
    app,
    io,
    httpServer,
    start,
    stop,
  };
}

export function startServer(options?: CmuxOptions): CmuxServer {
  const server = createCmuxServer(options);
  server.start();
  return server;
}
