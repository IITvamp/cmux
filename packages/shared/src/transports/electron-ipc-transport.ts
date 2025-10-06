import type { RpcTransport } from "capnweb";

// Type definition for Electron IPC in the renderer process
declare global {
  interface Window {
    electron?: {
      ipcRenderer: {
        send(channel: string, ...args: unknown[]): void;
        on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
        removeListener(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
      };
    };
  }
}

/**
 * ElectronIpcTransport - Custom RpcTransport for Electron IPC communication
 * 
 * This transport bridges Cap'n Web RPC over Electron's IPC mechanism, allowing
 * the renderer process to communicate with the main process using RPC.
 */
export class ElectronIpcTransport implements RpcTransport {
  private channelName: string;
  private receiveQueue: Array<{ resolve: (message: string) => void }> = [];
  private messageQueue: string[] = [];
  private listenerCleanup?: () => void;

  constructor(channelName: string = "capnweb-rpc") {
    this.channelName = channelName;
    this.setupListener();
  }

  private setupListener(): void {
    if (!window.electron?.ipcRenderer) {
      throw new Error("Electron IPC not available");
    }

    const handler = (_event: unknown, ...args: unknown[]) => {
      const message = args[0] as string;
      if (this.receiveQueue.length > 0) {
        const waiter = this.receiveQueue.shift();
        waiter?.resolve(message);
      } else {
        this.messageQueue.push(message);
      }
    };

    window.electron.ipcRenderer.on(`${this.channelName}:response`, handler);

    this.listenerCleanup = () => {
      window.electron?.ipcRenderer.removeListener(
        `${this.channelName}:response`,
        handler
      );
    };
  }

  async send(message: string): Promise<void> {
    if (!window.electron?.ipcRenderer) {
      throw new Error("Electron IPC not available");
    }
    
    window.electron.ipcRenderer.send(`${this.channelName}:request`, message);
  }

  async receive(): Promise<string> {
    // If we have queued messages, return the first one
    if (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) return message;
    }

    // Otherwise, wait for the next message
    return new Promise<string>((resolve) => {
      this.receiveQueue.push({ resolve });
    });
  }

  abort(reason: unknown): void {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    
    // Reject all waiting receivers
    for (const waiter of this.receiveQueue) {
      waiter.resolve(JSON.stringify({ error: error.message }));
    }
    this.receiveQueue = [];
    this.messageQueue = [];
    
    // Cleanup listener
    this.listenerCleanup?.();
  }
}

/**
 * Create an Electron IPC transport for use with Cap'n Web
 */
export function createElectronIpcTransport(
  channelName?: string
): RpcTransport {
  return new ElectronIpcTransport(channelName);
}