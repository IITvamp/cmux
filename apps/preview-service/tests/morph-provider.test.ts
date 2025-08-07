import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MorphProvider } from '../src/services/morph.js';
import { ProviderFactory, type ProviderConfig } from '../src/services/provider-factory.js';
import type { PreviewConfig } from '../src/types/index.js';

// Mock the MorphCloudClient
vi.mock('morphcloud', () => ({
  MorphCloudClient: vi.fn().mockImplementation(() => ({
    instances: {
      start: vi.fn(),
      get: vi.fn(),
    },
  })),
}));

// Upload file is now handled internally via SFTP

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn().mockReturnValue({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  }),
}));

describe('MorphProvider', () => {
  let provider: MorphProvider;
  let mockClient: any;
  let mockInstance: any;

  beforeEach(async () => {
    // Clear all provider instances
    ProviderFactory.clearProviders();
    
    // Create provider instance
    provider = await MorphProvider.create();
    
    // Access the mock client
    // Access the private client for mocking - we need this for unit testing
    // @ts-expect-error - accessing private property for testing
    mockClient = provider.client;
    
    // Setup mock instance
    mockInstance = {
      id: 'test-instance-123',
      networking: {
        httpServices: [
          { name: 'vscode', url: 'https://vscode.example.com', port: 39378 },
          { name: 'worker', url: 'https://worker.example.com', port: 39377 },
        ],
      },
      stop: vi.fn().mockResolvedValue(undefined),
      snapshot: vi.fn().mockResolvedValue({ id: 'snapshot-456' }),
      exec: vi.fn().mockResolvedValue({
        stdout: 'test output',
        stderr: '',
        exit_code: 0,
      }),
      exposeHttpService: vi.fn().mockResolvedValue(undefined),
      waitUntilReady: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Factory Integration', () => {
    it('should create MorphProvider through factory', async () => {
      const config: ProviderConfig = {
        type: 'morph',
      };
      
      const provider = await ProviderFactory.getProvider(config);
      expect(provider).toBeInstanceOf(MorphProvider);
      expect(provider.providerName).toBe('Morph');
    });

    it('should return cached provider on subsequent calls', async () => {
      const config: ProviderConfig = {
        type: 'morph',
      };
      
      const provider1 = await ProviderFactory.getProvider(config);
      const provider2 = await ProviderFactory.getProvider(config);
      
      expect(provider1).toBe(provider2);
    });

    it('should get provider from environment variables', async () => {
      const originalEnv = process.env.SANDBOX_PROVIDER;
      process.env.SANDBOX_PROVIDER = 'morph';
      
      const provider = await ProviderFactory.getProviderFromEnv();
      expect(provider).toBeInstanceOf(MorphProvider);
      
      process.env.SANDBOX_PROVIDER = originalEnv;
    });

    it('should throw error for unknown provider type', async () => {
      // Test with an invalid provider type by bypassing TypeScript
      // This tests runtime validation of provider types
      const getProviderWithInvalidType = () => {
        const config: ProviderConfig = JSON.parse('{"type":"unknown"}');
        return ProviderFactory.getProvider(config);
      };
      
      await expect(getProviderWithInvalidType()).rejects.toThrow(
        'Unknown provider type: unknown'
      );
    });
  });

  describe('createInstance', () => {
    it('should create instance with snapshot ID', async () => {
      mockClient.instances.start.mockResolvedValue(mockInstance);
      
      const result = await provider.createInstance({
        snapshotId: 'snapshot-123',
      });
      
      expect(mockClient.instances.start).toHaveBeenCalledWith({
        snapshotId: 'snapshot-123',
      });
      expect(result).toEqual({
        id: 'test-instance-123',
        status: 'running',
        services: [
          { name: 'vscode', url: 'https://vscode.example.com', port: 39378 },
          { name: 'worker', url: 'https://worker.example.com', port: 39377 },
        ],
      });
    });

    it('should throw error when snapshotId is not provided', async () => {
      await expect(provider.createInstance()).rejects.toThrow(
        'snapshotId is required to create an instance'
      );
    });

    it('should ignore resource configuration (not supported)', async () => {
      mockClient.instances.start.mockResolvedValue(mockInstance);
      
      const result = await provider.createInstance({
        snapshotId: 'snapshot-123',
        resources: {
          vcpus: 4,
          memory: 8192,
          diskSize: 50,
        },
      });
      
      // Resources are ignored in current implementation
      expect(mockClient.instances.start).toHaveBeenCalledWith({
        snapshotId: 'snapshot-123',
      });
      expect(result.id).toBe('test-instance-123');
    });
  });

  describe('getInstance', () => {
    it('should get existing instance', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      const result = await provider.getInstance('test-instance-123');
      
      expect(mockClient.instances.get).toHaveBeenCalledWith({
        instanceId: 'test-instance-123',
      });
      expect(result).toEqual({
        id: 'test-instance-123',
        status: 'running',
        services: [
          { name: 'vscode', url: 'https://vscode.example.com', port: 39378 },
          { name: 'worker', url: 'https://worker.example.com', port: 39377 },
        ],
      });
    });

    it('should return null when instance not found', async () => {
      mockClient.instances.get.mockRejectedValue(new Error('Instance not found'));
      
      const result = await provider.getInstance('non-existent');
      
      expect(result).toBeNull();
    });

    it('should set status to stopped when no services', async () => {
      const stoppedInstance = {
        ...mockInstance,
        networking: { httpServices: [] },
      };
      mockClient.instances.get.mockResolvedValue(stoppedInstance);
      
      const result = await provider.getInstance('test-instance-123');
      
      expect(result?.status).toBe('stopped');
    });
  });

  describe('stopInstance', () => {
    it('should stop instance', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      await provider.stopInstance('test-instance-123');
      
      expect(mockClient.instances.get).toHaveBeenCalledWith({
        instanceId: 'test-instance-123',
      });
      expect(mockInstance.stop).toHaveBeenCalled();
    });
  });

  describe('createSnapshot', () => {
    it('should create snapshot with metadata', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      const snapshotId = await provider.createSnapshot('test-instance-123', {
        name: 'Test Snapshot',
        description: 'Test description',
      });
      
      expect(mockInstance.snapshot).toHaveBeenCalledWith({
        metadata: {
          name: 'Test Snapshot',
          description: 'Test description',
        },
      });
      expect(snapshotId).toBe('snapshot-456');
    });

    it('should create snapshot without metadata', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      const snapshotId = await provider.createSnapshot('test-instance-123');
      
      expect(mockInstance.snapshot).toHaveBeenCalledWith({
        metadata: undefined,
      });
      expect(snapshotId).toBe('snapshot-456');
    });
  });

  describe('exec', () => {
    it('should execute command', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      const result = await provider.exec('test-instance-123', 'ls -la');
      
      expect(mockInstance.exec).toHaveBeenCalledWith('ls -la');
      expect(result).toEqual({
        stdout: 'test output',
        stderr: '',
        exitCode: 0,
      });
    });

    it('should execute command with cwd option', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      await provider.exec('test-instance-123', 'ls', { cwd: '/root/workspace' });
      
      expect(mockInstance.exec).toHaveBeenCalledWith('cd /root/workspace && ls');
    });

    it('should execute command with environment variables', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      await provider.exec('test-instance-123', 'echo $TEST', {
        env: { TEST: 'value', FOO: 'bar' },
      });
      
      expect(mockInstance.exec).toHaveBeenCalledWith('TEST="value" FOO="bar" echo $TEST');
    });

    it('should execute command with both cwd and env', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      await provider.exec('test-instance-123', 'npm install', {
        cwd: '/root/workspace',
        env: { NODE_ENV: 'production' },
      });
      
      expect(mockInstance.exec).toHaveBeenCalledWith(
        'NODE_ENV="production" cd /root/workspace && npm install'
      );
    });
  });

  describe('exposeHttpService', () => {
    it('should expose HTTP service and return URL', async () => {
      mockClient.instances.get
        .mockResolvedValueOnce(mockInstance)
        .mockResolvedValueOnce({
          ...mockInstance,
          networking: {
            httpServices: [
              ...mockInstance.networking.httpServices,
              { name: 'app', url: 'https://app.example.com', port: 3000 },
            ],
          },
        });
      
      const url = await provider.exposeHttpService('test-instance-123', 'app', 3000);
      
      expect(mockInstance.exposeHttpService).toHaveBeenCalledWith('app', 3000);
      expect(url).toBe('https://app.example.com');
    });

    it('should throw error if service not found after expose', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      await expect(
        provider.exposeHttpService('test-instance-123', 'app', 3000)
      ).rejects.toThrow('Failed to expose service app on port 3000');
    });
  });

  describe('waitForInstance', () => {
    it('should wait for instance to be ready', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      await provider.waitForInstance('test-instance-123');
      
      expect(mockInstance.waitUntilReady).toHaveBeenCalled();
    });

    it('should ignore timeout parameter (Morph handles internally)', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      await provider.waitForInstance('test-instance-123', 30000);
      
      expect(mockInstance.waitUntilReady).toHaveBeenCalled();
    });
  });

  describe('getInstanceStatus', () => {
    it('should return running when services are exposed', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      const status = await provider.getInstanceStatus('test-instance-123');
      
      expect(status).toBe('running');
    });

    it('should return stopped when no services', async () => {
      mockClient.instances.get.mockResolvedValue({
        ...mockInstance,
        networking: { httpServices: [] },
      });
      
      const status = await provider.getInstanceStatus('test-instance-123');
      
      expect(status).toBe('stopped');
    });

    it('should return not_found when instance does not exist', async () => {
      mockClient.instances.get.mockRejectedValue(new Error('Not found'));
      
      const status = await provider.getInstanceStatus('non-existent');
      
      expect(status).toBe('not_found');
    });
  });

  describe('uploadFile', () => {
    it('should upload file to instance via SFTP', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      // Mock SSH connection with NodeSSH interface
      const mockSSH = {
        execCommand: vi.fn().mockResolvedValue({ stdout: '', stderr: '', code: 0 }),
        dispose: vi.fn(),
      };
      
      mockInstance.ssh = vi.fn().mockResolvedValue(mockSSH);
      
      await provider.uploadFile('test-instance-123', 'file content', '/root/test.txt');
      
      expect(mockInstance.ssh).toHaveBeenCalled();
      expect(mockSSH.execCommand).toHaveBeenCalled();
      expect(mockSSH.dispose).toHaveBeenCalled();
    });
  });

  describe('setupDevcontainer (Morph-specific)', () => {
    it('should setup devcontainer with permission fixes', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      // Mock exec responses
      mockInstance.exec
        .mockResolvedValueOnce({ stdout: 'exists', stderr: '', exit_code: 0 }) // Check devcontainer
        .mockResolvedValueOnce({ stdout: '', stderr: '', exit_code: 0 }) // chown
        .mockResolvedValueOnce({ stdout: '', stderr: '', exit_code: 0 }) // chmod
        .mockResolvedValueOnce({ stdout: '', stderr: '', exit_code: 0 }); // devcontainer up
      
      await provider.setupDevcontainer('test-instance-123');
      
      expect(mockInstance.exec).toHaveBeenCalledTimes(4);
      expect(mockInstance.exec).toHaveBeenNthCalledWith(2, 'chown -R root:root /root/workspace');
      expect(mockInstance.exec).toHaveBeenNthCalledWith(3, 'chmod -R 755 /root/workspace');
    });

    it('should fallback to simple install when devcontainer setup fails', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      mockInstance.exec
        .mockResolvedValueOnce({ stdout: 'exists', stderr: '', exit_code: 0 }) // Check devcontainer
        .mockResolvedValueOnce({ stdout: '', stderr: '', exit_code: 0 }) // chown
        .mockResolvedValueOnce({ stdout: '', stderr: '', exit_code: 0 }) // chmod
        .mockResolvedValueOnce({ stdout: '', stderr: 'error', exit_code: 1 }) // devcontainer fails
        .mockResolvedValueOnce({ stdout: 'exists', stderr: '', exit_code: 0 }) // Check package.json
        .mockResolvedValueOnce({ stdout: '', stderr: '', exit_code: 0 }); // npm install
      
      await provider.setupDevcontainer('test-instance-123');
      
      const lastCall = mockInstance.exec.mock.calls[mockInstance.exec.mock.calls.length - 1][0];
      expect(lastCall).toContain('npm install || yarn install || bun install');
    });

    it('should skip devcontainer setup when not found', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      mockInstance.exec.mockResolvedValueOnce({
        stdout: 'not found',
        stderr: '',
        exit_code: 0,
      });
      
      await provider.setupDevcontainer('test-instance-123');
      
      expect(mockInstance.exec).toHaveBeenCalledTimes(1);
    });
  });

  describe('createPreviewEnvironment', () => {
    const previewConfig: PreviewConfig = {
      gitUrl: 'https://github.com/test/repo',
      branch: 'main',
      prNumber: 123,
      hasDevcontainer: false,
    };

    it('should create preview environment successfully', async () => {
      mockClient.instances.start.mockResolvedValue(mockInstance);
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      mockInstance.exec.mockResolvedValue({
        stdout: 'success',
        stderr: '',
        exit_code: 0,
      });
      
      const preview = await provider.createPreviewEnvironment({
        baseSnapshotId: 'base-snapshot-123',
        config: previewConfig,
      });
      
      expect(preview.id).toBe('test-instance-123');
      expect(preview.morphInstanceId).toBe('test-instance-123');
      expect(preview.urls!.vscode).toBe('https://vscode.example.com/?folder=/root/workspace');
      expect(preview.urls!.worker).toBe('https://worker.example.com');
      expect(preview.status).toBe('running');
    });

    it('should handle repository clone failure', async () => {
      mockClient.instances.start.mockResolvedValue(mockInstance);
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      mockInstance.exec.mockResolvedValue({
        stdout: '',
        stderr: 'Repository not found',
        exit_code: 128,
      });
      
      await expect(
        provider.createPreviewEnvironment({
          baseSnapshotId: 'base-snapshot-123',
          config: previewConfig,
        })
      ).rejects.toThrow('Failed to clone repository');
      
      expect(mockInstance.stop).toHaveBeenCalled();
    });

    it('should setup devcontainer when hasDevcontainer is true', async () => {
      mockClient.instances.start.mockResolvedValue(mockInstance);
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      mockInstance.exec
        .mockResolvedValueOnce({ stdout: '', stderr: '', exit_code: 0 }) // git clone
        .mockResolvedValueOnce({ stdout: 'exists', stderr: '', exit_code: 0 }) // check devcontainer
        .mockResolvedValueOnce({ stdout: '', stderr: '', exit_code: 0 }) // chown
        .mockResolvedValueOnce({ stdout: '', stderr: '', exit_code: 0 }) // chmod
        .mockResolvedValueOnce({ stdout: '', stderr: '', exit_code: 0 }); // devcontainer up
      
      await provider.createPreviewEnvironment({
        baseSnapshotId: 'base-snapshot-123',
        config: { ...previewConfig, hasDevcontainer: true },
      });
      
      // Verify devcontainer setup was called
      const execCalls = mockInstance.exec.mock.calls.map((call: any[]) => call[0]);
      expect(execCalls).toContain('chown -R root:root /root/workspace');
    });

    it('should run startup script when provided', async () => {
      mockClient.instances.start.mockResolvedValue(mockInstance);
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      mockInstance.exec.mockResolvedValue({
        stdout: '',
        stderr: '',
        exit_code: 0,
      });
      
      await provider.createPreviewEnvironment({
        baseSnapshotId: 'base-snapshot-123',
        config: {
          ...previewConfig,
          startupScript: 'npm install && npm run dev',
        },
      });
      
      // Verify startup script was executed
      const execCalls = mockInstance.exec.mock.calls.map((call: any[]) => call[0]);
      expect(execCalls.some((cmd: string) => cmd.includes('npm install && npm run dev'))).toBe(true);
    });
  });

  describe('pauseEnvironment', () => {
    it('should create snapshot and stop instance', async () => {
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      const snapshotId = await provider.pauseEnvironment('test-instance-123');
      
      expect(mockInstance.snapshot).toHaveBeenCalled();
      expect(mockInstance.stop).toHaveBeenCalled();
      expect(snapshotId).toBe('snapshot-456');
    });
  });

  describe('resumeEnvironment', () => {
    it('should resume from snapshot', async () => {
      mockClient.instances.start.mockResolvedValue(mockInstance);
      mockClient.instances.get.mockResolvedValue(mockInstance);
      
      const preview = await provider.resumeEnvironment('snapshot-456');
      
      expect(mockClient.instances.start).toHaveBeenCalledWith({
        snapshotId: 'snapshot-456',
      });
      expect(preview.id).toBe('test-instance-123');
      expect(preview.snapshotId).toBe('snapshot-456');
      expect(preview.urls!.vscode).toContain('/?folder=/root/workspace');
    });

    it('should throw error if required services not found', async () => {
      const instanceWithoutServices = {
        ...mockInstance,
        networking: { httpServices: [] },
      };
      mockClient.instances.start.mockResolvedValue(instanceWithoutServices);
      mockClient.instances.get.mockResolvedValue(instanceWithoutServices);
      
      await expect(provider.resumeEnvironment('snapshot-456')).rejects.toThrow(
        'Required services not found in resumed instance'
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('should export MorphService as alias for MorphProvider', async () => {
      const { MorphService } = await import('../src/services/morph.js');
      expect(MorphService).toBe(MorphProvider);
    });
  });
});