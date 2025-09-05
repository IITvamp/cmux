import { ipcMain, type WebContents } from "electron";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@cmux/shared";

interface IPCSocket {
  id: string;
  webContents: WebContents;
  handshake: { query: Record<string, string | string[] | undefined> };
  handlers: Map<string, Function[]>;
}

class IPCSocketServer {
  private sockets: Map<string, IPCSocket> = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();
  
  constructor() {
    this.setupIPCHandlers();
  }

  private setupIPCHandlers() {
    // Handle socket connection
    ipcMain.handle("socket:connect", async (event, query: Record<string, string>) => {
      const socketId = `ipc_${Date.now()}_${Math.random()}`;
      const socket: IPCSocket = {
        id: socketId,
        webContents: event.sender,
        handshake: { query },
        handlers: new Map(),
      };
      
      this.sockets.set(socketId, socket);
      
      // Emit connection event to server handlers
      this.emit("connection", socket);
      
      return { socketId, connected: true };
    });

    // Handle socket disconnect
    ipcMain.handle("socket:disconnect", async (_event, socketId: string) => {
      const socket = this.sockets.get(socketId);
      if (socket) {
        this.emit("disconnect", socket);
        this.sockets.delete(socketId);
      }
      return { disconnected: true };
    });

    // Handle socket events from client
    ipcMain.handle("socket:emit", async (_event, socketId: string, eventName: string, args: any[]) => {
      const socket = this.sockets.get(socketId);
      if (socket) {
        // Trigger handlers for this event
        const handlers = socket.handlers.get(eventName) || [];
        for (const handler of handlers) {
          handler(...args);
        }
      }
      return { success: true };
    });

    // Handle socket listener registration
    ipcMain.handle("socket:on", async (_event, socketId: string, eventName: string) => {
      const socket = this.sockets.get(socketId);
      if (socket) {
        // Create a handler that forwards to renderer
        const handler = (...args: any[]) => {
          if (!socket.webContents.isDestroyed()) {
            try {
              // Serialize args to avoid IPC cloning issues
              const serializedArgs = JSON.parse(JSON.stringify(args));
              socket.webContents.send(`socket:event:${socketId}`, eventName, ...serializedArgs);
            } catch (err) {
              console.error(`[IPCSocket] Failed to send event ${eventName}:`, err);
            }
          }
        };
        
        if (!socket.handlers.has(eventName)) {
          socket.handlers.set(eventName, []);
        }
        socket.handlers.get(eventName)!.push(handler);
      }
      return { success: true };
    });
  }

  // Server-side event handling
  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, ...args: any[]) {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      handler(...args);
    }
  }

  // Create a socket-like interface for server handlers
  wrapSocket(ipcSocket: IPCSocket): any {
    return {
      id: ipcSocket.id,
      handshake: ipcSocket.handshake,
      
      on<E extends keyof ClientToServerEvents>(
        event: E,
        handler: ClientToServerEvents[E]
      ) {
        if (!ipcSocket.handlers.has(event as string)) {
          ipcSocket.handlers.set(event as string, []);
        }
        ipcSocket.handlers.get(event as string)!.push(handler as Function);
      },
      
      emit<E extends keyof ServerToClientEvents>(
        event: E,
        ...args: Parameters<ServerToClientEvents[E]>
      ) {
        if (!ipcSocket.webContents.isDestroyed()) {
          // Serialize args to avoid IPC cloning issues
          try {
            const serializedArgs = JSON.parse(JSON.stringify(args));
            ipcSocket.webContents.send(`socket:event:${ipcSocket.id}`, event, ...serializedArgs);
          } catch (err) {
            console.error(`[IPCSocket] Failed to emit ${String(event)}:`, err);
          }
        }
      },
      
      disconnect() {
        this.sockets.delete(ipcSocket.id);
        if (!ipcSocket.webContents.isDestroyed()) {
          ipcSocket.webContents.send(`socket:event:${ipcSocket.id}`, "disconnect");
        }
      }
    };
  }
}

export const ipcSocketServer = new IPCSocketServer();