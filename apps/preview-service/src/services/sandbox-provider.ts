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

/**
 * Abstract base class for sandbox providers (Morph, E2B, Daytona, etc.)
 */
export abstract class SandboxProvider {
  protected baseSnapshotId: string | null = null;
  
  abstract readonly providerName: string;
  
  /**
   * Set the base snapshot/image ID to use for new instances
   */
  setBaseSnapshotId(snapshotId: string): void {
    this.baseSnapshotId = snapshotId;
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
   * Execute a command in the instance
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
   * Create a preview environment with streaming logs
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
      const workerService = instance.services.find(s => s.port === 39377);

      if (!vscodeService || !workerService) {
        throw new Error('Required services (VSCode/Worker) not found in sandbox instance');
      }

      // Create preview environment object
      const preview: PreviewEnvironment = {
        id: instance.id,
        config,
        status: 'running',
        morphInstanceId: instance.id, // TODO: Make this generic
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
      // Stop instance on error
      await this.stopInstance(instance.id);
      throw error;
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
      config: {} as PreviewConfig, // This would be stored/retrieved from database
      status: 'running',
      morphInstanceId: instance.id, // TODO: Make this generic
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
    
    const result = await this.exec(
      instanceId,
      `cd /root && git clone -b ${config.branch} ${config.gitUrl} workspace`
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
    const checkResult = await this.exec(
      instanceId,
      'test -f /root/workspace/.devcontainer/devcontainer.json && echo "exists" || echo "not found"'
    );

    if (!checkResult.stdout.includes('exists')) {
      log('No devcontainer.json found, skipping devcontainer setup');
      return;
    }

    // Run devcontainer CLI
    const setupResult = await this.exec(
      instanceId,
      'cd /root/workspace && bunx @devcontainers/cli up --workspace-folder .'
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
    const writeResult = await this.exec(
      instanceId,
      `cat > /tmp/startup.sh << 'EOF'
#!/bin/bash
set -e
cd /root/workspace
${script}
EOF`
    );

    if (writeResult.exitCode !== 0) {
      throw new Error(`Failed to write startup script: ${writeResult.stderr}`);
    }

    // Make executable and run
    await this.exec(instanceId, 'chmod +x /tmp/startup.sh');
    const runResult = await this.exec(instanceId, '/tmp/startup.sh');

    if (runResult.exitCode !== 0) {
      throw new Error(`Startup script failed: ${runResult.stderr}`);
    }

    log('Startup script completed');
  }
}