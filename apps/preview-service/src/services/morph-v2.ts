import { MorphCloudClient, type Instance } from 'morphcloud';
import type { PreviewConfig, PreviewEnvironment } from '../types/index.js';
import { SandboxProviderV2, type ExecResult, type SnapshotMetadata } from './sandbox-provider-v2.js';
import { uploadFileFromString } from '../utils/upload-file.js';

export class MorphProviderV2 extends SandboxProviderV2 {
  readonly providerName = 'Morph';
  private static client = new MorphCloudClient();

  static async createPreviewEnvironment(
    config: PreviewConfig,
    logHandler?: (message: string) => void
  ): Promise<PreviewEnvironment> {
    const log = (msg: string) => this.log('Morph', msg, logHandler);

    if (!this.baseSnapshotId) {
      throw new Error('Base snapshot ID not set. Please create a base snapshot first.');
    }

    log(`Creating preview environment from snapshot ${this.baseSnapshotId}`);
    
    // Create instance
    const snapshot = await this.client.snapshots.get({ snapshotId: this.baseSnapshotId });
    const instance = await this.client.instances.start({ snapshotId: snapshot.id });
    
    try {
      // Wait for instance to be ready
      await instance.waitUntilReady();
      log(`Instance ${instance.id} is ready`);

      // Get worker URL (already exposed in base snapshot)
      const workerService = instance.networking.httpServices.find(s => s.name === 'worker');
      if (!workerService) {
        throw new Error('Worker service not found in instance');
      }

      // Clone repository with streaming logs
      await this.cloneRepository(instance.id, config, workerService.url, logHandler);

      // Setup devcontainer if needed
      if (config.hasDevcontainer) {
        await this.setupDevcontainer(instance.id, workerService.url, logHandler);
      } else if (config.startupScript) {
        await this.runStartupScript(instance.id, config.startupScript, workerService.url, logHandler);
      }

      // Get service URLs
      const vscodeService = instance.networking.httpServices.find(s => s.name === 'vscode');
      
      const preview: PreviewEnvironment = {
        id: instance.id,
        config,
        status: 'running',
        morphInstanceId: instance.id,
        urls: {
          vscode: vscodeService?.url || '',
          worker: workerService.url,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return preview;
    } catch (error) {
      // Clean up on error
      await instance.stop();
      throw error;
    }
  }

  private static async cloneRepository(
    instanceId: string,
    config: PreviewConfig,
    workerUrl: string,
    logHandler?: (message: string) => void
  ): Promise<void> {
    const log = (msg: string) => this.log('Morph', msg, logHandler);
    
    log(`Cloning repository ${config.gitUrl} (branch: ${config.branch})`);
    
    const result = await this.execWithWorker(
      workerUrl,
      `cd /root && git clone -b ${config.branch} ${config.gitUrl} workspace`,
      { logHandler }
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to clone repository: ${result.stderr}`);
    }

    log('Repository cloned successfully');
  }

  private static async setupDevcontainer(
    instanceId: string,
    workerUrl: string,
    logHandler?: (message: string) => void
  ): Promise<void> {
    const log = (msg: string) => this.log('Morph', msg, logHandler);
    
    log('Setting up devcontainer');
    
    // Check if devcontainer.json exists
    const checkResult = await this.execWithWorker(
      workerUrl,
      'test -f /root/workspace/.devcontainer/devcontainer.json && echo "exists" || echo "not found"',
      { logHandler }
    );

    if (!checkResult.stdout.includes('exists')) {
      log('No devcontainer.json found, skipping devcontainer setup');
      return;
    }

    // Fix permissions
    await this.execWithWorker(workerUrl, 'chown -R root:root /root/workspace', { logHandler });
    await this.execWithWorker(workerUrl, 'chmod -R 755 /root/workspace', { logHandler });

    // Run devcontainer CLI
    const setupResult = await this.execWithWorker(
      workerUrl,
      'cd /root/workspace && bunx @devcontainers/cli up --workspace-folder . --skip-post-create',
      { 
        logHandler,
        cwd: '/root/workspace'
      }
    );

    if (setupResult.exitCode !== 0) {
      // Fallback to simple dependency install
      log('Devcontainer setup failed, trying simple dependency install');
      
      const pkgCheck = await this.execWithWorker(
        workerUrl,
        'test -f /root/workspace/package.json && echo "exists" || echo "not found"',
        { logHandler }
      );
      
      if (pkgCheck.stdout.includes('exists')) {
        await this.execWithWorker(
          workerUrl,
          'cd /root/workspace && npm install || yarn install || bun install',
          { logHandler }
        );
      }
    }

    log('Devcontainer setup completed');
  }

  private static async runStartupScript(
    instanceId: string,
    script: string,
    workerUrl: string,
    logHandler?: (message: string) => void
  ): Promise<void> {
    const log = (msg: string) => this.log('Morph', msg, logHandler);
    
    log('Running custom startup script');
    
    // Write script to file
    const writeResult = await this.execWithWorker(
      workerUrl,
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
    await this.execWithWorker(workerUrl, 'chmod +x /tmp/startup.sh', { logHandler });
    const runResult = await this.execWithWorker(workerUrl, '/tmp/startup.sh', { logHandler });

    if (runResult.exitCode !== 0) {
      throw new Error(`Startup script failed: ${runResult.stderr}`);
    }

    log('Startup script completed');
  }

  static async stopInstance(instanceId: string): Promise<void> {
    const instance = await this.client.instances.get({ instanceId });
    await instance.stop();
  }

  static async createSnapshot(
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

  static async getInstanceStatus(
    instanceId: string
  ): Promise<'running' | 'stopped' | 'not_found'> {
    try {
      const instance = await this.client.instances.get({ instanceId });
      const hasServices = instance.networking.httpServices.length > 0;
      return hasServices ? 'running' : 'stopped';
    } catch (error) {
      return 'not_found';
    }
  }

  static async uploadFile(
    instanceId: string,
    content: string,
    remotePath: string
  ): Promise<void> {
    const instance = await this.client.instances.get({ instanceId });
    await uploadFileFromString(instance, content, remotePath);
  }
}