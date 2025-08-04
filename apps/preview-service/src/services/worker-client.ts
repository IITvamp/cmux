import { io, type Socket } from 'socket.io-client';

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  onOutput?: (data: { stdout?: string; stderr?: string }) => void;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class WorkerClient {
  private socket: Socket | null = null;
  private connected = false;

  async connect(url: string): Promise<void> {
    if (this.connected) return;

    this.socket = io(url, {
      transports: ['websocket'],
      reconnection: false,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker connection timeout'));
      }, 10000);

      this.socket!.on('connect', () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve();
      });

      this.socket!.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Worker connection failed: ${error.message}`));
      });
    });
  }

  async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
    if (!this.socket || !this.connected) {
      throw new Error('Worker not connected');
    }

    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substring(7);
      let stdout = '';
      let stderr = '';

      // Set up response handlers
      const outputHandler = (data: any) => {
        if (data.requestId !== requestId) return;
        
        if (data.stdout) {
          stdout += data.stdout;
          options?.onOutput?.({ stdout: data.stdout });
        }
        if (data.stderr) {
          stderr += data.stderr;
          options?.onOutput?.({ stderr: data.stderr });
        }
      };

      const completeHandler = (data: any) => {
        if (data.requestId !== requestId) return;
        
        // Clean up listeners
        this.socket!.off('exec:output', outputHandler);
        this.socket!.off('exec:complete', completeHandler);
        this.socket!.off('exec:error', errorHandler);

        resolve({
          stdout,
          stderr,
          exitCode: data.exitCode,
        });
      };

      const errorHandler = (data: any) => {
        if (data.requestId !== requestId) return;
        
        // Clean up listeners
        this.socket!.off('exec:output', outputHandler);
        this.socket!.off('exec:complete', completeHandler);
        this.socket!.off('exec:error', errorHandler);

        reject(new Error(data.error));
      };

      // Register handlers
      this.socket!.on('exec:output', outputHandler);
      this.socket!.on('exec:complete', completeHandler);
      this.socket!.on('exec:error', errorHandler);

      // Send exec request
      this.socket!.emit('exec', {
        requestId,
        command,
        options: {
          cwd: options?.cwd,
          env: options?.env,
        },
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }
}