import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@cmux/shared";

// IPC Socket client that mimics Socket.IO API but uses Electron IPC
// We don't implement the full Socket interface, just what we need
export class IPCSocketClient {
  private socketId?: string;
  private eventHandlers: Map<string, Set<Function>> = new Map();
  private _connected = false;
  
  // @ts-ignore - Socket.IO compatibility
  public id = "";
  // @ts-ignore
  public connected = false;
  // @ts-ignore
  public disconnected = true;
  // @ts-ignore
  public io = {} as any;
  // @ts-ignore
  public nsp = "/";
  // @ts-ignore
  public recovered = [];

  constructor(private query: Record<string, string>) {}

  connect() {
    if (this._connected) return this;
    
    // Connect via IPC asynchronously
    window.cmux.socket.connect(this.query).then(result => {
      this.socketId = result.socketId;
      this._connected = true;
      this.connected = true;
      this.disconnected = false;
      this.id = result.socketId;
      
      // Setup event listener for server events
      window.cmux.socket.onEvent(this.socketId, (eventName: string, ...args: any[]) => {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
          handlers.forEach(handler => handler(...args));
        }
      });
      
      // Emit connect event
      this.emitEvent("connect");
    }).catch(error => {
      console.error("[IPCSocket] Connection failed:", error);
      this.emitEvent("connect_error", error);
    });
    
    return this;
  }

  disconnect() {
    if (!this._connected || !this.socketId) return this;
    
    window.cmux.socket.disconnect(this.socketId);
    this._connected = false;
    this.connected = false;
    this.disconnected = true;
    this.emitEvent("disconnect");
    
    return this;
  }

  on<E extends keyof ServerToClientEvents>(
    event: E | string,
    handler: ServerToClientEvents[E] | Function
  ): this {
    if (!this.eventHandlers.has(event as string)) {
      this.eventHandlers.set(event as string, new Set());
    }
    this.eventHandlers.get(event as string)!.add(handler as Function);
    
    // Register with server if connected
    if (this._connected && this.socketId) {
      window.cmux.socket.on(this.socketId, event as string);
    }
    
    return this;
  }

  once<E extends keyof ServerToClientEvents>(
    event: E | string,
    handler: ServerToClientEvents[E] | Function
  ): this {
    const wrappedHandler = (...args: any[]) => {
      (handler as Function)(...args);
      this.off(event, wrappedHandler);
    };
    return this.on(event, wrappedHandler);
  }

  off<E extends keyof ServerToClientEvents>(
    event?: E | string,
    handler?: ServerToClientEvents[E] | Function
  ): this {
    if (!event) {
      this.eventHandlers.clear();
    } else if (!handler) {
      this.eventHandlers.delete(event as string);
    } else {
      const handlers = this.eventHandlers.get(event as string);
      if (handlers) {
        handlers.delete(handler as Function);
      }
    }
    return this;
  }

  emit<E extends keyof ClientToServerEvents>(
    event: E | string,
    ...args: Parameters<ClientToServerEvents[E]> | any[]
  ): this {
    if (this._connected && this.socketId) {
      window.cmux.socket.emit(this.socketId, event as string, ...args);
    }
    return this;
  }

  private emitEvent(event: string, ...args: any[]) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  // Compatibility methods
  close() { return this.disconnect(); }
  open() { return this.connect(); }
  send(...args: any[]) { return this.emit("message", ...args); }
  
  // Stub methods for Socket.IO compatibility
  compress(_compress: boolean) { return this; }
  volatile = { emit: this.emit.bind(this) };
  timeout(_timeout: number) { return this; }
  onAny(_handler: Function) { return this; }
  prependAny(_handler: Function) { return this; }
  offAny(_handler?: Function) { return this; }
  onAnyOutgoing(_handler: Function) { return this; }
  prependAnyOutgoing(_handler: Function) { return this; }
  offAnyOutgoing(_handler?: Function) { return this; }
  listenersAny() { return []; }
  listenersAnyOutgoing() { return []; }
}

// Factory function to create IPC socket client
export function createIPCSocket(
  _url: string,
  options: { query?: Record<string, string> }
): IPCSocketClient {
  const socket = new IPCSocketClient(options.query || {});
  // Auto-connect like Socket.IO does
  setTimeout(() => socket.connect(), 0);
  return socket;
}