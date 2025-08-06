import { MorphCloudClient } from 'morphcloud';
import { 
  SandboxProvider, 
  type SandboxInstance, 
  type ExecResult, 
  type SnapshotMetadata,
  type SandboxService
} from './sandbox-provider.js';
import { uploadFileFromString } from '../utils/upload-file.js';

export class MorphProvider extends SandboxProvider {
  private client: MorphCloudClient;
  readonly providerName = 'Morph';
  
  constructor() {
    super();
    this.client = new MorphCloudClient();
  }

  async createInstance(config?: {
    snapshotId?: string;
    resources?: {
      vcpus?: number;
      memory?: number;
      diskSize?: number;
    };
  }): Promise<SandboxInstance> {
    const instance = await this.client.instances.start({
      snapshotId: config?.snapshotId || this.baseSnapshotId!,
    });

    // Get exposed services
    const services: SandboxService[] = instance.networking.httpServices.map(service => ({
      name: service.name,
      url: service.url,
      port: service.port,
    }));

    return {
      id: instance.id,
      status: 'running',
      services,
    };
  }

  async getInstance(instanceId: string): Promise<SandboxInstance | null> {
    try {
      const instance = await this.client.instances.get({ instanceId });
      
      const services: SandboxService[] = instance.networking.httpServices.map(service => ({
        name: service.name,
        url: service.url,
        port: service.port,
      }));

      return {
        id: instance.id,
        status: services.length > 0 ? 'running' : 'stopped',
        services,
      };
    } catch (error) {
      return null;
    }
  }

  async stopInstance(instanceId: string): Promise<void> {
    const instance = await this.client.instances.get({ instanceId });
    await instance.stop();
  }

  async createSnapshot(
    instanceId: string,
    metadata?: SnapshotMetadata
  ): Promise<string> {
    const instance = await this.client.instances.get({ instanceId });
    
    const snapshot = await instance.snapshot({
      metadata: metadata ? {
        name: metadata.name,
        description: metadata.description,
      } : undefined,
    });

    return snapshot.id;
  }

  async exec(
    instanceId: string,
    command: string,
    options?: {
      cwd?: string;
      env?: Record<string, string>;
    }
  ): Promise<ExecResult> {
    const instance = await this.client.instances.get({ instanceId });
    
    // Build command with options
    let fullCommand = command;
    if (options?.cwd) {
      fullCommand = `cd ${options.cwd} && ${command}`;
    }
    if (options?.env) {
      const envVars = Object.entries(options.env)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      fullCommand = `${envVars} ${fullCommand}`;
    }

    const result = await instance.exec(fullCommand);
    
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exit_code,
    };
  }

  async exposeHttpService(
    instanceId: string,
    name: string,
    port: number
  ): Promise<string> {
    const instance = await this.client.instances.get({ instanceId });
    await instance.exposeHttpService(name, port);
    
    // Get the updated instance to find the service URL
    const updatedInstance = await this.client.instances.get({ instanceId });
    const service = updatedInstance.networking.httpServices.find(
      s => s.name === name && s.port === port
    );

    if (!service) {
      throw new Error(`Failed to expose service ${name} on port ${port}`);
    }

    return service.url;
  }

  async waitForInstance(instanceId: string, _timeout?: number): Promise<void> {
    const instance = await this.client.instances.get({ instanceId });
    await instance.waitUntilReady();
  }

  async getInstanceStatus(instanceId: string): Promise<'running' | 'stopped' | 'not_found'> {
    try {
      const instance = await this.client.instances.get({ instanceId });
      // Check if instance has exposed services (indicates it's running)
      const hasServices = instance.networking.httpServices.length > 0;
      return hasServices ? 'running' : 'stopped';
    } catch (error) {
      return 'not_found';
    }
  }

  async uploadFile(
    instanceId: string,
    content: string,
    remotePath: string
  ): Promise<void> {
    const instance = await this.client.instances.get({ instanceId });
    await uploadFileFromString(instance, content, remotePath);
  }

  /**
   * Override setupDevcontainer to fix permission issues
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

    // Fix permissions before running devcontainer
    await this.exec(instanceId, 'chown -R root:root /root/workspace');
    await this.exec(instanceId, 'chmod -R 755 /root/workspace');

    // Run devcontainer CLI with proper permissions
    const setupResult = await this.exec(
      instanceId,
      'cd /root/workspace && bunx @devcontainers/cli up --workspace-folder . --skip-post-create'
    );

    if (setupResult.exitCode !== 0) {
      // If it fails, try a simpler approach - just install dependencies
      log('Devcontainer setup failed, trying simple dependency install');
      
      // Check for package.json and install dependencies
      const pkgCheck = await this.exec(instanceId, 'test -f /root/workspace/package.json && echo "exists" || echo "not found"');
      
      if (pkgCheck.stdout.includes('exists')) {
        await this.exec(instanceId, 'cd /root/workspace && npm install || yarn install || bun install');
      }
    }

    log('Devcontainer setup completed');
  }
}

// For backward compatibility
export const MorphService = MorphProvider;