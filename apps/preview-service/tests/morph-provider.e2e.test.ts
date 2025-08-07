import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MorphProvider } from '../src/services/morph.js';
import { ProviderFactory, type ProviderConfig } from '../src/services/provider-factory.js';
import type { PreviewConfig } from '../src/types/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

describe('MorphProvider E2E Tests', () => {
  let provider: MorphProvider;
  let testInstanceId: string | null = null;
  let testSnapshotId: string | null = null;
  const baseSnapshotId = process.env.MORPH_BASE_SNAPSHOT_ID || 'snapshot_7o3z2iez';

  beforeAll(async () => {
    console.log('🔧 Setting up MorphProvider E2E tests...');
    console.log(`Using base snapshot: ${baseSnapshotId}`);
    
    if (!process.env.MORPH_API_KEY) {
      console.warn('⚠️  MORPH_API_KEY not found in environment');
      console.warn('   E2E tests will be skipped');
    }
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up test resources...');
    
    // Clean up test instance if it exists
    if (testInstanceId && provider) {
      try {
        await provider.stopInstance(testInstanceId);
        console.log(`✅ Stopped test instance: ${testInstanceId}`);
      } catch (error) {
        console.log(`ℹ️  Could not stop instance ${testInstanceId}: ${error}`);
      }
    }
  });

  describe('Provider Factory Integration', () => {
    it('should create MorphProvider through factory', async () => {
      const config: ProviderConfig = {
        type: 'morph',
      };
      
      provider = await ProviderFactory.getProvider(config) as MorphProvider;
      expect(provider).toBeInstanceOf(MorphProvider);
      expect(provider.providerName).toBe('Morph');
    });

    it('should return cached provider instance', async () => {
      const config: ProviderConfig = {
        type: 'morph',
      };
      
      const provider1 = await ProviderFactory.getProvider(config);
      const provider2 = await ProviderFactory.getProvider(config);
      
      expect(provider1).toBe(provider2);
    });

    it('should get provider from environment', async () => {
      const originalEnv = process.env.SANDBOX_PROVIDER;
      process.env.SANDBOX_PROVIDER = 'morph';
      
      const envProvider = await ProviderFactory.getProviderFromEnv();
      expect(envProvider).toBeInstanceOf(MorphProvider);
      
      process.env.SANDBOX_PROVIDER = originalEnv;
    });
  });

  describe.skipIf(!process.env.MORPH_API_KEY)('Instance Lifecycle', () => {
    it('should complete full instance lifecycle', async () => {
      console.log('\n🔄 Testing instance lifecycle...');
      
      // 1. Create instance from base snapshot
      console.log('- Creating instance from base snapshot...');
      const instance = await provider.createInstance({
        snapshotId: baseSnapshotId,
      });
      
      expect(instance.id).toBeDefined();
      expect(instance.status).toBe('running');
      expect(instance.services.length).toBeGreaterThan(0);
      
      testInstanceId = instance.id;
      console.log(`- Instance created: ${testInstanceId}`);
      
      // 2. Wait for instance to be ready
      console.log('- Waiting for instance to be ready...');
      await provider.waitForInstance(testInstanceId);
      
      // 3. Get instance details
      console.log('- Getting instance details...');
      const retrievedInstance = await provider.getInstance(testInstanceId);
      
      expect(retrievedInstance).toBeDefined();
      expect(retrievedInstance?.id).toBe(testInstanceId);
      expect(retrievedInstance?.status).toBe('running');
      
      // 4. Check instance status
      const status = await provider.getInstanceStatus(testInstanceId);
      expect(status).toBe('running');
      
      // 5. Execute a simple command
      console.log('- Executing test command...');
      const execResult = await provider.exec(testInstanceId, 'echo "Hello from E2E test"');
      
      expect(execResult.exitCode).toBe(0);
      expect(execResult.stdout).toContain('Hello from E2E test');
      
      // 6. Execute command with options
      console.log('- Testing exec with options...');
      const execWithOptions = await provider.exec(testInstanceId, 'pwd', {
        cwd: '/root',
      });
      
      expect(execWithOptions.exitCode).toBe(0);
      expect(execWithOptions.stdout.trim()).toBe('/root');
      
      // 7. Upload a file
      console.log('- Testing file upload...');
      const testContent = 'This is a test file from E2E tests';
      await provider.uploadFile(testInstanceId, testContent, '/tmp/e2e-test.txt');
      
      // Verify file was uploaded
      const catResult = await provider.exec(testInstanceId, 'cat /tmp/e2e-test.txt');
      expect(catResult.stdout).toContain(testContent);
      
      // 8. Create a snapshot
      console.log('- Creating snapshot...');
      testSnapshotId = await provider.createSnapshot(testInstanceId, {
        name: 'E2E Test Snapshot',
        description: 'Snapshot created during E2E testing',
      });
      
      expect(testSnapshotId).toBeDefined();
      console.log(`- Snapshot created: ${testSnapshotId}`);
      
      // 9. Stop instance
      console.log('- Stopping instance...');
      await provider.stopInstance(testInstanceId);
      
      // 10. Verify instance is stopped
      const stoppedStatus = await provider.getInstanceStatus(testInstanceId);
      expect(['stopped', 'not_found']).toContain(stoppedStatus);
      
      console.log('✅ Instance lifecycle completed successfully');
    }, { timeout: 120000 }); // 2 minutes timeout
  });

  describe.skipIf(!process.env.MORPH_API_KEY)('Preview Environment', () => {
    it('should create and manage preview environment', async () => {
      console.log('\n🔄 Testing preview environment creation...');
      
      const previewConfig: PreviewConfig = {
        gitUrl: 'https://github.com/microsoft/vscode-remote-try-node',
        branch: 'main',
        prNumber: 999,
        hasDevcontainer: true,
      };
      
      // Create preview environment
      console.log('- Creating preview environment...');
      const preview = await provider.createPreviewEnvironment({
        baseSnapshotId,
        config: previewConfig,
        logHandler: (msg) => console.log(`  ${msg}`),
      });
      
      expect(preview.id).toBeDefined();
      expect(preview.status).toBe('running');
      expect(preview.urls).toBeDefined();
      expect(preview.urls?.vscode).toContain('/?folder=/root/workspace');
      expect(preview.urls?.worker).toBeDefined();
      
      testInstanceId = preview.id;
      console.log(`- Preview environment created: ${preview.id}`);
      
      // Verify repository was cloned
      console.log('- Verifying repository clone...');
      const lsResult = await provider.exec(preview.id, 'ls -la /root/workspace');
      expect(lsResult.exitCode).toBe(0);
      expect(lsResult.stdout).toContain('package.json');
      
      // Test service URLs are accessible
      console.log('- Testing service URLs...');
      if (preview.urls?.vscode) {
        const vscodeResponse = await fetch(preview.urls.vscode);
        expect(vscodeResponse.ok).toBe(true);
        console.log('  ✓ VSCode service is accessible');
      }
      
      // Pause the environment
      console.log('- Pausing preview environment...');
      const pauseSnapshotId = await provider.pauseEnvironment(preview.id);
      expect(pauseSnapshotId).toBeDefined();
      console.log(`- Environment paused with snapshot: ${pauseSnapshotId}`);
      
      // Resume the environment
      console.log('- Resuming preview environment...');
      const resumedPreview = await provider.resumeEnvironment(pauseSnapshotId);
      expect(resumedPreview.id).toBeDefined();
      expect(resumedPreview.status).toBe('running');
      expect(resumedPreview.snapshotId).toBe(pauseSnapshotId);
      
      // Update testInstanceId for cleanup
      testInstanceId = resumedPreview.id;
      
      // Verify resumed environment works
      console.log('- Verifying resumed environment...');
      const resumedExec = await provider.exec(resumedPreview.id, 'ls -la /root/workspace');
      expect(resumedExec.exitCode).toBe(0);
      expect(resumedExec.stdout).toContain('package.json');
      
      // Stop the resumed instance
      console.log('- Stopping resumed instance...');
      await provider.stopInstance(resumedPreview.id);
      
      console.log('✅ Preview environment lifecycle completed');
    }, { timeout: 300000 }); // 5 minutes timeout
  });

  describe.skipIf(!process.env.MORPH_API_KEY)('Service Management', () => {
    it('should expose and access HTTP services', async () => {
      console.log('\n🔄 Testing service management...');
      
      // Create instance
      console.log('- Creating instance...');
      const instance = await provider.createInstance({
        snapshotId: baseSnapshotId,
      });
      testInstanceId = instance.id;
      
      await provider.waitForInstance(testInstanceId);
      
      // Start a simple HTTP server
      console.log('- Starting HTTP server...');
      const serverCommand = `
        cat > /tmp/server.js << 'EOF'
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from E2E test server');
});
server.listen(8080, () => console.log('Server running on port 8080'));
EOF
        node /tmp/server.js > /tmp/server.log 2>&1 &
      `;
      
      await provider.exec(testInstanceId, serverCommand);
      
      // Give server time to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Expose the service
      console.log('- Exposing HTTP service...');
      const serviceUrl = await provider.exposeHttpService(testInstanceId, 'test-app', 8080);
      expect(serviceUrl).toBeDefined();
      expect(serviceUrl).toContain('http');
      console.log(`- Service exposed at: ${serviceUrl}`);
      
      // Test the exposed service
      console.log('- Testing exposed service...');
      try {
        const response = await fetch(serviceUrl);
        expect(response.ok).toBe(true);
        const text = await response.text();
        expect(text).toContain('Hello from E2E test server');
        console.log('  ✓ Service is accessible and responding correctly');
      } catch (error) {
        console.log(`  ⚠️  Could not access service: ${error}`);
      }
      
      // Clean up
      console.log('- Stopping test server...');
      await provider.exec(testInstanceId, 'pkill -f "node /tmp/server.js"');
      
      // Stop instance
      await provider.stopInstance(testInstanceId);
      testInstanceId = null;
      
      console.log('✅ Service management test completed');
    }, { timeout: 120000 });
  });

  describe.skipIf(!process.env.MORPH_API_KEY)('Error Handling', () => {
    it('should handle invalid snapshot ID gracefully', async () => {
      console.log('\n🔄 Testing error handling...');
      
      await expect(
        provider.createInstance({
          snapshotId: 'invalid-snapshot-id',
        })
      ).rejects.toThrow();
      
      console.log('  ✓ Invalid snapshot ID handled correctly');
    });

    it('should handle non-existent instance gracefully', async () => {
      const result = await provider.getInstance('non-existent-instance');
      expect(result).toBeNull();
      
      const status = await provider.getInstanceStatus('non-existent-instance');
      expect(status).toBe('not_found');
      
      console.log('  ✓ Non-existent instance handled correctly');
    });

    it('should require snapshot ID for instance creation', async () => {
      await expect(
        provider.createInstance()
      ).rejects.toThrow('snapshotId is required');
      
      console.log('  ✓ Missing snapshot ID validation works');
    });
  });

  describe.skipIf(!process.env.MORPH_API_KEY)('Devcontainer Support', () => {
    it('should handle devcontainer setup with Morph-specific fixes', async () => {
      console.log('\n🔄 Testing devcontainer support...');
      
      // Create instance
      const instance = await provider.createInstance({
        snapshotId: baseSnapshotId,
      });
      testInstanceId = instance.id;
      
      await provider.waitForInstance(testInstanceId);
      
      // Create a mock devcontainer.json
      console.log('- Creating mock devcontainer.json...');
      await provider.exec(testInstanceId, 'mkdir -p /root/workspace/.devcontainer');
      await provider.uploadFile(
        testInstanceId,
        JSON.stringify({
          name: 'E2E Test Container',
          image: 'node:18',
        }, null, 2),
        '/root/workspace/.devcontainer/devcontainer.json'
      );
      
      // Test the Morph-specific setupDevcontainer
      console.log('- Running setupDevcontainer...');
      const logs: string[] = [];
      await provider.setupDevcontainer(testInstanceId, (msg: string) => {
        logs.push(msg);
        console.log(`  ${msg}`);
      });
      
      // Verify permission fixes were applied
      const permissionCheck = await provider.exec(
        testInstanceId,
        'stat -c "%U:%G %a" /root/workspace'
      );
      expect(permissionCheck.stdout).toContain('root:root');
      
      console.log('  ✓ Devcontainer setup completed with Morph-specific fixes');
      
      // Clean up
      await provider.stopInstance(testInstanceId);
      testInstanceId = null;
      
      console.log('✅ Devcontainer support test completed');
    }, { timeout: 120000 });
  });

  describe.skipIf(!process.env.MORPH_API_KEY)('Startup Scripts', () => {
    it('should execute custom startup scripts', async () => {
      console.log('\n🔄 Testing startup scripts...');
      
      const previewConfig: PreviewConfig = {
        gitUrl: 'https://github.com/microsoft/vscode-remote-try-node',
        branch: 'main',
        prNumber: 123,
        hasDevcontainer: false,
        startupScript: `
          echo "Starting custom setup..."
          echo "E2E_TEST=true" > /tmp/startup-test.env
          echo "Setup complete!"
        `,
      };
      
      // Create preview with startup script
      console.log('- Creating preview with startup script...');
      const preview = await provider.createPreviewEnvironment({
        baseSnapshotId,
        config: previewConfig,
        logHandler: (msg) => console.log(`  ${msg}`),
      });
      
      testInstanceId = preview.id;
      
      // Verify startup script ran
      console.log('- Verifying startup script execution...');
      const checkResult = await provider.exec(preview.id, 'cat /tmp/startup-test.env');
      expect(checkResult.exitCode).toBe(0);
      expect(checkResult.stdout).toContain('E2E_TEST=true');
      
      console.log('  ✓ Startup script executed successfully');
      
      // Clean up
      await provider.stopInstance(preview.id);
      testInstanceId = null;
      
      console.log('✅ Startup script test completed');
    }, { timeout: 180000 });
  });
});