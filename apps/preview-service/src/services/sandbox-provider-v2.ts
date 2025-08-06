import type { PreviewConfig, PreviewEnvironment } from '../types/index.js';
import { WorkerClient } from './worker-client.js';

export interface SandboxService {
  name: string;
  url: string;
  port: number;
}

export interface SandboxInstance {
  id: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped';
  services: SandboxService[];
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SnapshotMetadata {
  name: string;
  description: string;
  createdAt?: Date;
}

/**
 * Base class for sandbox providers with static method pattern
 */
export abstract class SandboxProviderV2 {
  protected static baseSnapshotId: string | null = null;
  
  abstract readonly providerName: string;
  
  /**
   * Set the base snapshot/image ID to use for new instances
   */
  static setBaseSnapshotId(snapshotId: string): void {
    this.baseSnapshotId = snapshotId;
  }

  /**
   * Create a preview environment
   */
  static async createPreviewEnvironment(
    config: PreviewConfig,
    logHandler?: (message: string) => void
  ): Promise<PreviewEnvironment> {
    throw new Error('Must be implemented by subclass');
  }

  /**
   * Upload a file to the instance
   */
  static async uploadFile(
    instanceId: string,
    content: string,
    remotePath: string
  ): Promise<void> {
    throw new Error('Must be implemented by subclass');
  }

  /**
   * Execute command using worker for streaming
   */
  protected static async execWithWorker(
    workerUrl: string,
    command: string,
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      logHandler?: (message: string) => void;
    }
  ): Promise<ExecResult> {
    const client = new WorkerClient();
    
    try {
      await client.connect(workerUrl);
      
      const result = await client.exec(command, {
        cwd: options?.cwd,
        env: options?.env,
        onOutput: (data) => {
          if (data.stdout && options?.logHandler) {
            options.logHandler(data.stdout);
          }
          if (data.stderr && options?.logHandler) {
            options.logHandler(`[stderr] ${data.stderr}`);
          }
        },
      });
      
      return result;
    } finally {
      client.disconnect();
    }
  }

  /**
   * Helper to log messages
   */
  protected static log(
    providerName: string,
    message: string,
    logHandler?: (message: string) => void
  ): void {
    const fullMessage = `[${providerName}] ${message}`;
    console.log(fullMessage);
    logHandler?.(fullMessage);
  }
}