import { io, type Socket } from 'socket.io-client';
import type { PreviewConfig, PreviewEnvironment } from '../types/index.js';

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

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  logHandler?: (message: string) => void;
}

/**
 * Abstract base class for sandbox providers with socket.io integration
 */
export abstract class SandboxProvider {
  protected baseSnapshotId: string | null = null;
  protected socket: Socket | null = null;
  protected workerUrl: string | null = null;
  
  abstract readonly providerName: string;
  
  /**
   * Set the base snapshot/image ID to use for new instances
   */
  setBaseSnapshotId(snapshotId: string): void {
    this.baseSnapshotId = snapshotId;
  }

  /**
   * Connect to worker socket
   */
  protected async connectSocket(url: string): Promise<void> {
    if (this.socket && this.workerUrl === url) {
      return; // Already connected to this URL
    }

    // Disconnect existing socket if any
    this.disconnectSocket();

    this.workerUrl = url;
    this.socket = io(url, {
      transports: ['websocket'],
      reconnection: false,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.disconnectSocket();
        reject(new Error('Worker connection timeout'));
      }, 10000);

      this.socket!.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.on('connect_error', (error) => {
        clearTimeout(timeout);
        this.disconnectSocket();
        reject(new Error(`Worker connection failed: ${error.message}`));
      });
    });
  }

  /**
   * Disconnect socket
   */
  protected disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.workerUrl = null;
    }
  }

  /**
   * Execute command via socket if available, otherwise use instance exec
   */
  protected async execCommand(
    instanceId: string,
    command: string,
    options?: ExecOptions
  ): Promise<ExecResult> {
    // If we have a socket connection, use it for streaming
    if (this.socket && this.socket.connected) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substring(7);
        let stdout = '';
        let stderr = '';

        // Handle output
        const outputHandler = (data: { requestId: string; stdout?: string; stderr?: string }) => {
          if (data.requestId !== requestId) return;
          
          if (data.stdout) {
            stdout += data.stdout;
            options?.logHandler?.(data.stdout);
          }
          if (data.stderr) {
            stderr += data.stderr;
            options?.logHandler?.(`[stderr] ${data.stderr}`);
          }
        };

        // Handle completion
        const completeHandler = (data: { requestId: string; exitCode: number }) => {
          if (data.requestId !== requestId) return;
          
          this.socket!.off('exec:output', outputHandler);
          this.socket!.off('exec:complete', completeHandler);
          this.socket!.off('exec:error', errorHandler);

          resolve({
            stdout,
            stderr,
            exitCode: data.exitCode,
          });
        };

        // Handle errors
        const errorHandler = (data: { requestId: string; error: string }) => {
          if (data.requestId !== requestId) return;
          
          this.socket!.off('exec:output', outputHandler);
          this.socket!.off('exec:complete', completeHandler);
          this.socket!.off('exec:error', errorHandler);

          reject(new Error(data.error));
        };

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
    } else {
      // Fallback to direct exec
      return this.exec(instanceId, command, options);
    }
  }

  /**
   * Create a new sandbox instance from base snapshot
   */
  abstract createInstance(config?: {
    snapshotId?: string;
    resources?: {
      vcpus?: number;
      memory?: number;
      diskSize?: number;
    };
  }): Promise<SandboxInstance>;

  /**
   * Get an existing instance by ID
   */
  abstract getInstance(instanceId: string): Promise<SandboxInstance | null>;

  /**
   * Stop/terminate an instance
   */
  abstract stopInstance(instanceId: string): Promise<void>;

  /**
   * Create a snapshot of the current instance state
   */
  abstract createSnapshot(
    instanceId: string, 
    metadata?: SnapshotMetadata
  ): Promise<string>;

  /**
   * Execute a command in the instance (direct, without streaming)
   */
  abstract exec(
    instanceId: string,
    command: string,
    options?: {
      cwd?: string;
      env?: Record<string, string>;
    }
  ): Promise<ExecResult>;

  /**
   * Expose an HTTP service from the instance
   */
  abstract exposeHttpService(
    instanceId: string,
    name: string,
    port: number
  ): Promise<string>;

  /**
   * Wait for instance to be ready
   */
  abstract waitForInstance(
    instanceId: string,
    timeout?: number
  ): Promise<void>;

  /**
   * Get instance status
   */
  abstract getInstanceStatus(
    instanceId: string
  ): Promise<'running' | 'stopped' | 'not_found'>;

  /**
   * Upload a file to the instance
   */
  abstract uploadFile(
    instanceId: string,
    content: string,
    remotePath: string
  ): Promise<void>;

  /**
   * Create a preview environment with streaming logs (alias for consistency)
   */
  async createPreviewEnvironmentWithLogs(
    config: PreviewConfig,
    logHandler: (message: string) => void
  ): Promise<PreviewEnvironment> {
    return this.createPreviewEnvironment(config, logHandler);
  }

  /**
   * Create a preview environment with common setup steps
   */
  async createPreviewEnvironment(
    config: PreviewConfig,
    logHandler?: (message: string) => void
  ): Promise<PreviewEnvironment> {
    if (!this.baseSnapshotId) {
      throw new Error('Base snapshot ID not set. Please create a base snapshot first.');
    }

    const log = (msg: string) => {
      console.log(`[${this.providerName}] ${msg}`);
      logHandler?.(`[${this.providerName}] ${msg}`);
    };

    log(`Creating preview environment from snapshot ${this.baseSnapshotId}`);
    
    // Create instance from base snapshot
    const instance = await this.createInstance({
      snapshotId: this.baseSnapshotId,
    });

    try {
      // Wait for instance to be ready
      await this.waitForInstance(instance.id);
      log(`Instance ${instance.id} is ready`);

      // Connect to worker socket if available
      const workerService = instance.services.find(s => s.port === 39377);
      if (workerService?.url && logHandler) {
        await this.connectSocket(workerService.url);
      }

      // Clone the repository
      await this.setupRepository(instance.id, config, logHandler);

      // Run devcontainer setup if needed
      if (config.hasDevcontainer) {
        await this.setupDevcontainer(instance.id, logHandler);
      } else if (config.startupScript) {
        await this.runStartupScript(instance.id, config.startupScript, logHandler);
      }

      // Find required services
      const vscodeService = instance.services.find(s => s.port === 39378);

      if (!vscodeService || !workerService) {
        throw new Error('Required services (VSCode/Worker) not found in sandbox instance');
      }

      // Create preview environment object
      const preview: PreviewEnvironment = {
        id: instance.id,
        config,
        status: 'running',
        morphInstanceId: instance.id,
        urls: {
          vscode: `${vscodeService.url}/?folder=/root/workspace`,
          worker: workerService.url,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      return preview;
    } catch (error) {
      // Disconnect socket and stop instance on error
      this.disconnectSocket();
      await this.stopInstance(instance.id);
      throw error;
    } finally {
      // Always disconnect socket after setup
      this.disconnectSocket();
    }
  }

  /**
   * Pause environment by creating a snapshot and stopping the instance
   */
  async pauseEnvironment(instanceId: string): Promise<string> {
    console.log(`[${this.providerName}] Creating snapshot for instance ${instanceId}`);
    
    const snapshotId = await this.createSnapshot(instanceId, {
      name: `preview-${instanceId}-${Date.now()}`,
      description: 'Preview environment snapshot',
    });

    await this.stopInstance(instanceId);
    
    return snapshotId;
  }

  /**
   * Resume environment from a snapshot
   */
  async resumeEnvironment(snapshotId: string): Promise<PreviewEnvironment> {
    console.log(`[${this.providerName}] Resuming from snapshot ${snapshotId}`);
    
    const instance = await this.createInstance({ snapshotId });
    await this.waitForInstance(instance.id);

    // Find required services
    const vscodeService = instance.services.find(s => s.port === 39378);
    const workerService = instance.services.find(s => s.port === 39377);

    if (!vscodeService || !workerService) {
      throw new Error('Required services not found in resumed instance');
    }

    // Return updated preview environment
    return {
      id: instance.id,
      config: {} as PreviewConfig,
      status: 'running',
      morphInstanceId: instance.id,
      snapshotId,
      urls: {
        vscode: `${vscodeService.url}/?folder=/root/workspace`,
        worker: workerService.url,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessedAt: new Date(),
    };
  }

  /**
   * Common repository setup logic
   */
  protected async setupRepository(
    instanceId: string,
    config: PreviewConfig,
    logHandler?: (message: string) => void
  ): Promise<void> {
    const log = (msg: string) => {
      console.log(`[${this.providerName}] ${msg}`);
      logHandler?.(`[${this.providerName}] ${msg}`);
    };
    
    log(`Cloning repository ${config.gitUrl} (branch: ${config.branch})`);
    
    const result = await this.execCommand(
      instanceId,
      `cd /root && git clone -b ${config.branch} ${config.gitUrl} workspace`,
      { logHandler }
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to clone repository: ${result.stderr}`);
    }

    log('Repository cloned successfully');
  }

  /**
   * Common devcontainer setup logic
   */
  protected async setupDevcontainer(
    instanceId: string,
    logHandler?: (message: string) => void
  ): Promise<void> {
    const log = (msg: string) => {
      console.log(`[${this.providerName}] ${msg}`);
      logHandler?.(`[${this.providerName}] ${msg}`);
    };
    
    log('Setting up devcontainer');
    
    // Check if devcontainer.json exists
    const checkResult = await this.execCommand(
      instanceId,
      'test -f /root/workspace/.devcontainer/devcontainer.json && echo "exists" || echo "not found"',
      { logHandler }
    );

    if (!checkResult.stdout.includes('exists')) {
      log('No devcontainer.json found, skipping devcontainer setup');
      return;
    }

    // Run devcontainer CLI
    const setupResult = await this.execCommand(
      instanceId,
      'cd /root/workspace && bunx @devcontainers/cli up --workspace-folder .',
      { logHandler, cwd: '/root/workspace' }
    );

    if (setupResult.exitCode !== 0) {
      throw new Error(`Devcontainer setup failed: ${setupResult.stderr}`);
    }

    log('Devcontainer setup completed');
  }

  /**
   * Common startup script execution logic
   */
  protected async runStartupScript(
    instanceId: string,
    script: string,
    logHandler?: (message: string) => void
  ): Promise<void> {
    const log = (msg: string) => {
      console.log(`[${this.providerName}] ${msg}`);
      logHandler?.(`[${this.providerName}] ${msg}`);
    };
    
    log('Running custom startup script');
    
    // Write script to file
    const writeResult = await this.execCommand(
      instanceId,
      `cat > /tmp/startup.sh << 'EOF'
#!/bin/bash
set -e
cd /root/workspace
${script}
EOF`,
      { logHandler }
    );

    if (writeResult.exitCode !== 0) {
      throw new Error(`Failed to write startup script: ${writeResult.stderr}`);
    }

    // Make executable and run
    await this.execCommand(instanceId, 'chmod +x /tmp/startup.sh', { logHandler });
    const runResult = await this.execCommand(instanceId, '/tmp/startup.sh', { logHandler });

    if (runResult.exitCode !== 0) {
      throw new Error(`Startup script failed: ${runResult.stderr}`);
    }

    log('Startup script completed');
  }
}