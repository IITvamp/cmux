import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Docker from 'dockerode';
import { DockerVSCodeInstance } from './DockerVSCodeInstance';
import type { VSCodeInstanceConfig } from './VSCodeInstance';
import { getConvex } from '../utils/convexClient';
import { api } from '@cmux/convex/api';

// Test configuration
const TEST_TEAM_SLUG = 'test-team';
const TEST_IMAGE = process.env.WORKER_IMAGE_NAME || 'cmux-worker:0.0.1';

describe('Persistent VSCode Sessions', () => {
  let docker: Docker;
  let testRunId: string;
  let testWorkspaceVolume: string;
  let testVscodeVolume: string;

  beforeAll(async () => {
    docker = new Docker({ socketPath: '/var/run/docker.sock' });

    // Ensure test image exists
    try {
      await docker.getImage(TEST_IMAGE).inspect();
    } catch {
      console.warn(`Test image ${TEST_IMAGE} not found, tests may fail`);
    }
  });

  beforeEach(() => {
    // Generate unique IDs for each test
    const timestamp = Date.now();
    testRunId = `test-run-${timestamp}`;
    testWorkspaceVolume = `cmux_session_${testRunId}_workspace`;
    testVscodeVolume = `cmux_session_${testRunId}_vscode`;
  });

  afterAll(async () => {
    // Cleanup all test volumes
    const volumes = await docker.listVolumes();
    for (const volumeInfo of volumes.Volumes || []) {
      if (volumeInfo.Name?.startsWith('cmux_session_test-run-')) {
        try {
          const volume = docker.getVolume(volumeInfo.Name);
          await volume.remove();
          console.log(`Cleaned up test volume: ${volumeInfo.Name}`);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    // Cleanup all test containers
    const containers = await docker.listContainers({ all: true });
    for (const containerInfo of containers) {
      if (containerInfo.Names?.some(name => name.includes('cmux-test-run-'))) {
        try {
          const container = docker.getContainer(containerInfo.Id);
          await container.stop().catch(() => {});
          await container.remove();
          console.log(`Cleaned up test container: ${containerInfo.Names[0]}`);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });

  test('should create named volumes on first run', async () => {
    const config: VSCodeInstanceConfig = {
      taskRunId: testRunId as any,
      teamSlugOrId: TEST_TEAM_SLUG,
      workspacePath: '/tmp/test-workspace',
      agentName: 'test-agent',
    };

    const instance = new DockerVSCodeInstance(config);

    // Start the instance
    await instance.start();

    // Verify volumes were created
    const volumes = await docker.listVolumes();
    const workspaceVolume = volumes.Volumes?.find(v => v.Name === testWorkspaceVolume);
    const vscodeVolume = volumes.Volumes?.find(v => v.Name === testVscodeVolume);

    expect(workspaceVolume).toBeDefined();
    expect(vscodeVolume).toBeDefined();

    // Stop the instance (preserving volumes)
    await instance.stop({ preserveVolumes: true });
  });

  test('should reuse existing volumes on resume', async () => {
    // First, create volumes by starting an instance
    const config: VSCodeInstanceConfig = {
      taskRunId: testRunId as any,
      teamSlugOrId: TEST_TEAM_SLUG,
      workspacePath: '/tmp/test-workspace',
      agentName: 'test-agent',
    };

    const instance1 = new DockerVSCodeInstance(config);
    await instance1.start();

    // Write a test file to the workspace volume
    const container1 = docker.getContainer(`cmux-${testRunId}`);
    await container1.exec({
      Cmd: ['bash', '-c', 'echo "test content" > /root/workspace/test-file.txt'],
      AttachStdout: true,
      AttachStderr: true,
    }).then(exec => exec.start());

    // Stop the instance (preserving volumes)
    await instance1.stop({ preserveVolumes: true });

    // Create a new instance with the same ID
    const instance2 = new DockerVSCodeInstance(config);
    await instance2.start();

    // Verify the test file still exists
    const container2 = docker.getContainer(`cmux-${testRunId}`);
    const exec = await container2.exec({
      Cmd: ['cat', '/root/workspace/test-file.txt'],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ Detach: false });
    const output = await new Promise<string>((resolve) => {
      let data = '';
      stream.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      stream.on('end', () => resolve(data));
    });

    expect(output).toContain('test content');

    // Cleanup
    await instance2.stop({ preserveVolumes: false });
  });

  test('should clean up volumes when preserveVolumes is false', async () => {
    const config: VSCodeInstanceConfig = {
      taskRunId: testRunId as any,
      teamSlugOrId: TEST_TEAM_SLUG,
      workspacePath: '/tmp/test-workspace',
      agentName: 'test-agent',
    };

    const instance = new DockerVSCodeInstance(config);
    await instance.start();

    // Verify volumes exist
    let volumes = await docker.listVolumes();
    expect(volumes.Volumes?.some(v => v.Name === testWorkspaceVolume)).toBe(true);
    expect(volumes.Volumes?.some(v => v.Name === testVscodeVolume)).toBe(true);

    // Stop the instance and clean up volumes
    await instance.stop({ preserveVolumes: false });

    // Verify volumes were removed
    volumes = await docker.listVolumes();
    expect(volumes.Volumes?.some(v => v.Name === testWorkspaceVolume)).toBe(false);
    expect(volumes.Volumes?.some(v => v.Name === testVscodeVolume)).toBe(false);
  });

  test('should detect resume vs first run via environment variable', async () => {
    const config: VSCodeInstanceConfig = {
      taskRunId: testRunId as any,
      teamSlugOrId: TEST_TEAM_SLUG,
      workspacePath: '/tmp/test-workspace',
      agentName: 'test-agent',
    };

    // First run
    const instance1 = new DockerVSCodeInstance(config);
    await instance1.start();

    // Check CMUX_RESUME environment variable (should be false)
    const container1 = docker.getContainer(`cmux-${testRunId}`);
    const exec1 = await container1.exec({
      Cmd: ['bash', '-c', 'echo $CMUX_RESUME'],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream1 = await exec1.start({ Detach: false });
    const output1 = await new Promise<string>((resolve) => {
      let data = '';
      stream1.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      stream1.on('end', () => resolve(data));
    });

    expect(output1.trim()).toContain('false');

    await instance1.stop({ preserveVolumes: true });

    // Resume run
    const instance2 = new DockerVSCodeInstance(config);
    await instance2.start();

    // Check CMUX_RESUME environment variable (should be true)
    const container2 = docker.getContainer(`cmux-${testRunId}`);
    const exec2 = await container2.exec({
      Cmd: ['bash', '-c', 'echo $CMUX_RESUME'],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream2 = await exec2.start({ Detach: false });
    const output2 = await new Promise<string>((resolve) => {
      let data = '';
      stream2.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      stream2.on('end', () => resolve(data));
    });

    expect(output2.trim()).toContain('true');

    // Cleanup
    await instance2.stop({ preserveVolumes: false });
  });

  test('should handle volume lifecycle correctly', async () => {
    const volumeNames: string[] = [];

    // Create multiple instances to test lifecycle
    for (let i = 0; i < 3; i++) {
      const runId = `test-run-lifecycle-${Date.now()}-${i}`;
      volumeNames.push(`cmux_session_${runId}_workspace`);
      volumeNames.push(`cmux_session_${runId}_vscode`);

      const config: VSCodeInstanceConfig = {
        taskRunId: runId as any,
        teamSlugOrId: TEST_TEAM_SLUG,
        workspacePath: '/tmp/test-workspace',
        agentName: 'test-agent',
      };

      const instance = new DockerVSCodeInstance(config);
      await instance.start();

      // Stop and preserve volumes
      await instance.stop({ preserveVolumes: true });
    }

    // Verify all volumes exist
    const volumes = await docker.listVolumes();
    for (const volumeName of volumeNames) {
      expect(volumes.Volumes?.some(v => v.Name === volumeName)).toBe(true);
    }

    // Clean up test volumes
    for (const volumeName of volumeNames) {
      try {
        const volume = docker.getVolume(volumeName);
        await volume.remove();
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});