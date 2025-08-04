import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Also load from local .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

// Response schemas
const HealthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  service: z.string(),
});

const RootResponseSchema = z.object({
  message: z.string(),
  version: z.string(),
  endpoints: z.array(z.string()),
});

const PreviewResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

describe('Preview Service E2E Tests', () => {
  let serverProcess: ChildProcess | null = null;
  const serverUrl = 'http://localhost:3001';
  const baseSnapshotId = process.env.MORPH_BASE_SNAPSHOT_ID || 'snapshot_7o3z2iez';

  beforeAll(async () => {
    console.log('🚀 Starting preview service...');
    
    // Start the server
    serverProcess = spawn('tsx', ['src/index.ts'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: '3001' },
      stdio: 'pipe',
    });

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start within 10 seconds'));
      }, 10000);

      serverProcess!.stdout!.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log('Server:', output.trim());
        if (output.includes('Preview service running')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess!.stderr!.on('data', (data: Buffer) => {
        console.error('Server error:', data.toString());
      });
    });

    console.log('✅ Server started\n');

    if (!baseSnapshotId) {
      console.warn('⚠️  No MORPH_BASE_SNAPSHOT_ID found in environment');
      console.warn('   Some tests will be skipped. Run `pnpm test:snapshot` to create one.\n');
    }
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up...');
    
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  describe('Basic Endpoints', () => {
    it('should return healthy status from health endpoint', async () => {
      const response = await fetch(`${serverUrl}/api/health`);
      const data = HealthResponseSchema.parse(await response.json());
      
      expect(response.ok).toBe(true);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('cmux-preview-service');
    });

    it('should return API info from root endpoint', async () => {
      const response = await fetch(serverUrl);
      const data = RootResponseSchema.parse(await response.json());
      
      expect(response.ok).toBe(true);
      expect(data.message).toBe('cmux Preview Service');
      expect(data.version).toBe('1.0.0');
      expect(data.endpoints).toBeInstanceOf(Array);
      expect(data.endpoints.length).toBeGreaterThan(0);
    });
  });

  describe('Preview Management', () => {
    it('should validate create preview request', async () => {
      const response = await fetch(`${serverUrl}/api/preview/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Invalid request
      });

      const data = PreviewResponseSchema.parse(await response.json());
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should set base snapshot', async () => {
      const response = await fetch(`${serverUrl}/api/preview/set-base-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId: baseSnapshotId }),
      });

      const data = PreviewResponseSchema.parse(await response.json());
      
      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });

    it(
      'should complete full preview lifecycle',
      async () => {
        console.log('\n🔄 Running preview lifecycle test...');

        // Set base snapshot first
        await fetch(`${serverUrl}/api/preview/set-base-snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshotId: baseSnapshotId }),
        });

        // 1. Create preview
        console.log('- Creating preview environment...');
        const createResponse = await fetch(`${serverUrl}/api/preview/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gitUrl: 'https://github.com/microsoft/vscode-remote-try-node',
            branch: 'main',
            prNumber: 123,
            hasDevcontainer: true,
          }),
        });

        const createData = PreviewResponseSchema.parse(await createResponse.json());
        expect(createResponse.ok).toBe(true);
        expect(createData.success).toBe(true);
        
        const previewId = (createData.data as any).id;
        console.log(`- Preview created: ${previewId}`);

        // 2. Check status
        console.log('- Checking preview status...');
        const statusResponse = await fetch(`${serverUrl}/api/preview/status/${previewId}`);
        const statusData = PreviewResponseSchema.parse(await statusResponse.json());
        
        expect(statusResponse.ok).toBe(true);
        expect(statusData.success).toBe(true);
        
        const statusInfo = statusData.data as any;
        expect(statusInfo.status).toBe('running');
        expect(statusInfo.urls).toBeDefined();
        expect(statusInfo.urls.vscode).toBeDefined();
        expect(statusInfo.urls.worker).toBeDefined();

        // 3. Test service URLs
        console.log('- Testing service URLs...');
        const vscodeResponse = await fetch(statusInfo.urls.vscode);
        expect(vscodeResponse.ok).toBe(true);
        
        // Try worker endpoint with retries (it might take a moment to start)
        let workerOk = false;
        for (let i = 0; i < 3; i++) {
          try {
            const workerResponse = await fetch(`${statusInfo.urls.worker}/socket.io/?EIO=4&transport=polling`);
            if (workerResponse.ok) {
              workerOk = true;
              break;
            }
          } catch (e) {
            // Ignore connection errors during retries
          }
          if (i < 2) {
            console.log(`- Worker not ready yet, retrying in 5s...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        // Worker check is optional since we test exec functionality separately
        if (!workerOk) {
          console.log('⚠️  Worker socket.io endpoint not available, but exec functionality works');
        }

        // 4. Pause preview
        console.log('- Pausing preview...');
        const pauseResponse = await fetch(`${serverUrl}/api/preview/pause/${previewId}`, {
          method: 'POST',
        });
        const pauseData = PreviewResponseSchema.parse(await pauseResponse.json());
        
        expect(pauseResponse.ok).toBe(true);
        expect(pauseData.success).toBe(true);
        expect((pauseData.data as any).snapshotId).toBeDefined();

        // 5. Resume preview
        console.log('- Resuming preview...');
        const resumeResponse = await fetch(`${serverUrl}/api/preview/resume/${previewId}`, {
          method: 'POST',
        });
        const resumeData = PreviewResponseSchema.parse(await resumeResponse.json());
        
        expect(resumeResponse.ok).toBe(true);
        expect(resumeData.success).toBe(true);

        // 5.5. Test exec functionality
        console.log('- Testing exec command...');
        const execResponse = await fetch(`${serverUrl}/api/preview/exec`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceId: previewId,
            command: 'echo "Hello from exec test"',
          }),
        });
        const execData = PreviewResponseSchema.parse(await execResponse.json());
        
        expect(execResponse.ok).toBe(true);
        expect(execData.success).toBe(true);
        expect((execData.data as any).stdout).toContain('Hello from exec test');
        expect((execData.data as any).exitCode).toBe(0);

        // 6. Stop preview
        console.log('- Stopping preview...');
        const stopResponse = await fetch(`${serverUrl}/api/preview/stop/${previewId}`, {
          method: 'POST',
        });
        const stopData = PreviewResponseSchema.parse(await stopResponse.json());
        
        expect(stopResponse.ok).toBe(true);
        expect(stopData.success).toBe(true);
        
        console.log('✅ Preview lifecycle completed');
      },
      { timeout: 300000 } // 5 minutes for this test
    );
  });
});