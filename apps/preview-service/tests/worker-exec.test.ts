import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WorkerClient } from '../src/services/worker-client';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Worker Exec Tests', () => {
  let workerProcess: ChildProcess;
  let client: WorkerClient;
  const workerUrl = 'http://localhost:39377';

  beforeAll(async () => {
    // Start a local worker for testing
    workerProcess = spawn('node', [
      path.join(__dirname, '../src/worker/streaming-worker.cjs')
    ], {
      env: { ...process.env, WORKER_PORT: '39377' },
      stdio: 'pipe',
    });

    // Wait for worker to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker failed to start'));
      }, 5000);

      workerProcess.stdout?.on('data', (data) => {
        if (data.toString().includes('Worker listening')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      workerProcess.stderr?.on('data', (data) => {
        console.error('Worker error:', data.toString());
      });
    });

    // Create client
    client = new WorkerClient();
    await client.connect(workerUrl);
  });

  afterAll(async () => {
    client.disconnect();
    workerProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  it('should execute simple command', async () => {
    const result = await client.exec('echo "Hello World"');
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Hello World');
    expect(result.stderr).toBe('');
  });

  it('should handle command with error', async () => {
    const result = await client.exec('ls /nonexistent');
    
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should stream output', async () => {
    const outputs: string[] = [];
    
    const result = await client.exec('for i in 1 2 3; do echo "Line $i"; sleep 0.1; done', {
      onOutput: (data) => {
        if (data.stdout) outputs.push(data.stdout);
      }
    });
    
    expect(result.exitCode).toBe(0);
    expect(outputs.length).toBeGreaterThan(0);
    expect(outputs.some(o => o.includes('Line 1'))).toBe(true);
    expect(outputs.some(o => o.includes('Line 2'))).toBe(true);
    expect(outputs.some(o => o.includes('Line 3'))).toBe(true);
  });

  it('should handle cwd option', async () => {
    const result = await client.exec('pwd', {
      cwd: '/tmp'
    });
    
    expect(result.exitCode).toBe(0);
    // On macOS, /tmp is a symlink to /private/tmp
    expect(result.stdout.trim()).toMatch(/^(\/tmp|\/private\/tmp)$/);
  });

  it('should handle env option', async () => {
    const result = await client.exec('echo $TEST_VAR', {
      env: { TEST_VAR: 'test123' }
    });
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('test123');
  });

  it('should handle multiline output', async () => {
    const result = await client.exec('echo -e "line1\\nline2\\nline3"');
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('line1');
    expect(result.stdout).toContain('line2');
    expect(result.stdout).toContain('line3');
  });

  it('should handle stderr output', async () => {
    const outputs: { stdout?: string; stderr?: string }[] = [];
    
    const result = await client.exec('echo "stdout" && echo "stderr" >&2', {
      onOutput: (data) => outputs.push(data)
    });
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('stdout');
    expect(result.stderr).toContain('stderr');
    expect(outputs.some(o => o.stdout?.includes('stdout'))).toBe(true);
    expect(outputs.some(o => o.stderr?.includes('stderr'))).toBe(true);
  });
});