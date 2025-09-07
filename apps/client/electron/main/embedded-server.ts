import { ipcMain } from "electron";
import type { RealtimeServer, RealtimeSocket } from "@cmux/server/realtime";

// This starts the full server functionality over IPC (no HTTP port needed)
export async function startEmbeddedServer() {
  console.log("[EmbeddedServer] Starting full server over IPC transport");

  // Lazily import server pieces to avoid loading failures before app is ready
  const [{ setupSocketHandlers }, { GitDiffManager }] = await Promise.all([
    import("@cmux/server/socket-handlers"),
    import("@cmux/server/gitDiff"),
  ]);

  // Initialize the git diff manager
  const gitDiffManager = new GitDiffManager();

  // Create IPC-based realtime server that implements the RealtimeServer interface
  const ipcRealtimeServer = createIPCRealtimeServer();

  // Setup the FULL server socket handlers - this gives us complete parity
  setupSocketHandlers(ipcRealtimeServer, gitDiffManager, null);

  console.log("[EmbeddedServer] Full server started successfully over IPC");

  return {
    async cleanup() {
      gitDiffManager.dispose();
      await ipcRealtimeServer.close();
    },
  };
}

// Create an IPC-based implementation of RealtimeServer
function createIPCRealtimeServer(): RealtimeServer {
  const sockets = new Map<string, IPCSocket>();
  const webContentsToSocketId = new Map<number, string>();
  const connectionHandlers: Array<(socket: RealtimeSocket) => void> = [];

  interface IPCSocket {
    id: string;
    webContents: Electron.WebContents;
    handshake: { query: Record<string, string | string[] | undefined> };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handlers: Map<string, Array<(...args: any[]) => void>>;
    middlewares: Array<(packet: unknown[], next: () => void) => void>;
  }

  // Handle IPC connection from renderer
  ipcMain.handle(
    "socket:connect",
    async (event, query: Record<string, string>) => {
      const socketId = `ipc_${Date.now()}_${Math.random()}`;
      const ipcSocket: IPCSocket = {
        id: socketId,
        webContents: event.sender,
        handshake: { query },
        handlers: new Map(),
        middlewares: [],
      };

      sockets.set(socketId, ipcSocket);
      webContentsToSocketId.set(event.sender.id, socketId);

      // Create a RealtimeSocket wrapper for the server handlers
      const realtimeSocket: RealtimeSocket = {
        id: socketId,
        handshake: ipcSocket.handshake,

        on(event: any, handler: any) {
          if (!ipcSocket.handlers.has(event)) {
            ipcSocket.handlers.set(event, []);
          }
          ipcSocket.handlers.get(event)!.push(handler);
        },

        emit(event: any, ...args: any[]) {
          if (!ipcSocket.webContents.isDestroyed()) {
            try {
              // Send event to renderer via IPC
              ipcSocket.webContents.send(
                `socket:event:${socketId}`,
                event,
                ...args
              );
            } catch (err) {
              console.error(`[IPC] Failed to emit ${event}:`, err);
            }
          }
        },

        use(middleware: (packet: unknown[], next: () => void) => void) {
          ipcSocket.middlewares.push(middleware);
        },

        disconnect() {
          sockets.delete(socketId);
          if (!ipcSocket.webContents.isDestroyed()) {
            ipcSocket.webContents.send(
              `socket:event:${socketId}`,
              "disconnect"
            );
          }
        },
      };

      // Notify all connection handlers
      connectionHandlers.forEach((handler) => handler(realtimeSocket));

      return { socketId, connected: true };
    }
  );

  // Cmux-style simple register (used by window.cmux.register)
  ipcMain.handle(
    "cmux:register",
    async (
      event,
      meta: { auth?: string; team?: string; auth_json?: string }
    ) => {
      // Ensure one logical socket per renderer
      const existingId = webContentsToSocketId.get(event.sender.id);
      if (existingId) {
        sockets.delete(existingId);
      }

      const socketId = `cmux_${event.sender.id}`;
      const ipcSocket: IPCSocket = {
        id: socketId,
        webContents: event.sender,
        handshake: {
          query: {
            auth: meta?.auth,
            team: meta?.team,
            auth_json: meta?.auth_json,
          },
        },
        handlers: new Map(),
        middlewares: [],
      };

      sockets.set(socketId, ipcSocket);
      webContentsToSocketId.set(event.sender.id, socketId);

      // Notify connection handlers to wire server-side listeners
      const realtimeSocket: RealtimeSocket = {
        id: socketId,
        handshake: ipcSocket.handshake,
        on(event: any, handler: any) {
          if (!ipcSocket.handlers.has(event)) ipcSocket.handlers.set(event, []);
          ipcSocket.handlers.get(event)!.push(handler);
        },
        emit(event: any, ...args: any[]) {
          if (!ipcSocket.webContents.isDestroyed()) {
            try {
              ipcSocket.webContents.send(
                `socket:event:${socketId}`,
                event,
                ...args
              );
              // Also emit cmux:event for cmux-style renderer client
              ipcSocket.webContents.send(`cmux:event:${event}`, ...args);
            } catch (err) {
              console.error(`[IPC] Failed to emit ${event}:`, err);
            }
          }
        },
        use(middleware: (packet: unknown[], next: () => void) => void) {
          ipcSocket.middlewares.push(middleware);
        },
        disconnect() {
          sockets.delete(socketId);
          webContentsToSocketId.delete(event.sender.id);
          if (!ipcSocket.webContents.isDestroyed()) {
            ipcSocket.webContents.send(
              `socket:event:${socketId}`,
              "disconnect"
            );
          }
        },
      };

      connectionHandlers.forEach((handler) => handler(realtimeSocket));

      return { success: true };
    }
  );

  // Handle IPC disconnect
  ipcMain.handle("socket:disconnect", async (_event, socketId: string) => {
    const socket = sockets.get(socketId);
    if (socket) {
      // Trigger disconnect handlers
      const handlers = socket.handlers.get("disconnect") || [];
      handlers.forEach((handler) => handler());
      sockets.delete(socketId);
    }
    return { disconnected: true };
  });

  // Handle events from renderer
  ipcMain.handle(
    "socket:emit",
    async (_event, socketId: string, eventName: string, args: unknown[]) => {
      const socket = sockets.get(socketId);
      if (!socket) return { success: false };

      // Check for callback
      const lastArg = args[args.length - 1];
      const hasCallback =
        typeof lastArg === "string" && lastArg.includes("_callback_");

      if (hasCallback) {
        const callbackId = lastArg as string;
        const dataArgs = args.slice(0, -1);

        // Run middlewares
        runMiddlewares(socket.middlewares, [eventName, ...dataArgs], () => {
          // Execute handlers with callback
          const handlers = socket.handlers.get(eventName) || [];
          handlers.forEach((handler) => {
            handler(...dataArgs, (response: unknown) => {
              // Send callback response to renderer
              if (!socket.webContents.isDestroyed()) {
                socket.webContents.send(
                  `socket:event:${socketId}`,
                  `ack:${callbackId}`,
                  response
                );
              }
            });
          });
        });
      } else {
        // Run middlewares
        runMiddlewares(socket.middlewares, [eventName, ...args], () => {
          // Execute handlers without callback
          const handlers = socket.handlers.get(eventName) || [];
          handlers.forEach((handler) => handler(...args));
        });
      }

      return { success: true };
    }
  );

  // Cmux-style RPC (invoke single handler expecting ack)
  ipcMain.handle(
    "cmux:rpc",
    async (
      event,
      { event: eventName, args }: { event: string; args: unknown[] }
    ) => {
      const socketId = webContentsToSocketId.get(event.sender.id);
      if (!socketId)
        throw new Error("Socket not registered. Call register first.");
      const socket = sockets.get(socketId);
      if (!socket) throw new Error("Socket not found for sender");

      // Execute through middlewares then call the first handler with ack
      return await new Promise((resolve, reject) => {
        try {
          runMiddlewares(socket.middlewares, [eventName, ...args], () => {
            const handlers = socket.handlers.get(eventName) || [];
            if (handlers.length === 0) {
              reject(new Error(`No handler for event: ${eventName}`));
              return;
            }
            const handler = handlers[0];
            // Provide ack callback as last arg
            const ack = (result?: unknown) => resolve(result);
            if (args.length === 0) handler(ack);
            else handler(...args, ack);
          });
        } catch (err) {
          reject(err);
        }
      });
    }
  );

  // Handle listener registration from renderer
  ipcMain.handle(
    "socket:on",
    async (_event, socketId: string, eventName: string) => {
      const socket = sockets.get(socketId);
      if (socket) {
        // Register that renderer wants to listen to this event
        // (Events will be sent via socket:event:${socketId} channel)
      }
      return { success: true };
    }
  );

  return {
    onConnection(handler: (socket: RealtimeSocket) => void) {
      connectionHandlers.push(handler);
    },

    emit(event: any, ...args: any[]) {
      // Broadcast to all connected sockets
      sockets.forEach((socket) => {
        if (!socket.webContents.isDestroyed()) {
          try {
            socket.webContents.send(
              `socket:event:${socket.id}`,
              event,
              ...args
            );
            // Also broadcast on cmux:event for cmux-style renderer client
            socket.webContents.send(`cmux:event:${event}`, ...args);
          } catch (err) {
            console.error(`[IPC] Failed to broadcast ${event}:`, err);
          }
        }
      });
    },

    async close() {
      // Clean up all sockets
      sockets.forEach((socket) => {
        if (!socket.webContents.isDestroyed()) {
          socket.webContents.send(`socket:event:${socket.id}`, "disconnect");
        }
      });
      sockets.clear();
      connectionHandlers.length = 0;
    },
  };
}

function runMiddlewares(
  middlewares: Array<(packet: unknown[], next: () => void) => void>,
  packet: unknown[],
  finalCallback: () => void
) {
  let index = 0;

  function next() {
    if (index >= middlewares.length) {
      finalCallback();
      return;
    }

    const middleware = middlewares[index++];
    middleware(packet, next);
  }

  next();
}
