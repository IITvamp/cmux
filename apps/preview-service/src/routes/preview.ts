import { Hono } from 'hono';
import type { SandboxProvider } from '../services/sandbox-provider.js';
import { ProviderFactory } from '../services/provider-factory.js';
import { CreatePreviewRequestSchema, type PreviewResponse, type PreviewEnvironment } from '../types/index.js';

const preview = new Hono();

// Get provider based on environment configuration
let sandboxProvider: SandboxProvider;

// Initialize provider on first use
const getProvider = async (): Promise<SandboxProvider> => {
  if (!sandboxProvider) {
    sandboxProvider = await ProviderFactory.getProviderFromEnv();
  }
  return sandboxProvider;
};

// In-memory storage for preview environments (replace with database in production)
export const previewEnvironments = new Map<string, PreviewEnvironment>();

// Create preview environment
preview.post('/create', async (c) => {
  const body = await c.req.json();
  
  // Validate request body
  const validation = CreatePreviewRequestSchema.safeParse(body);
  if (!validation.success) {
    return c.json<PreviewResponse>({
      success: false,
      error: validation.error.errors.map(e => e.message).join(', '),
    }, 400);
  }

  try {
    const provider = await getProvider();
    const preview = await provider.createPreviewEnvironment(validation.data);
    
    // Store preview environment
    previewEnvironments.set(preview.id, preview);
    
    return c.json<PreviewResponse>({
      success: true,
      data: preview,
    });
  } catch (error) {
    console.error('Failed to create preview:', error);
    return c.json<PreviewResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create preview environment',
    }, 500);
  }
});

// Pause preview environment
preview.post('/pause/:id', async (c) => {
  const { id } = c.req.param();
  
  const preview = previewEnvironments.get(id);
  if (!preview) {
    return c.json<PreviewResponse>({
      success: false,
      error: 'Preview environment not found',
    }, 404);
  }

  try {
    const provider = await getProvider();
    const snapshotId = await provider.pauseEnvironment(id);
    
    // Update preview state
    preview.status = 'paused';
    preview.snapshotId = snapshotId;
    preview.pausedAt = new Date();
    preview.updatedAt = new Date();
    
    return c.json<PreviewResponse>({
      success: true,
      data: { snapshotId },
    });
  } catch (error) {
    return c.json<PreviewResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pause environment',
    }, 500);
  }
});

// Resume preview environment
preview.post('/resume/:id', async (c) => {
  const { id } = c.req.param();
  
  const preview = previewEnvironments.get(id);
  if (!preview || !preview.snapshotId) {
    return c.json<PreviewResponse>({
      success: false,
      error: 'Preview environment not found or not paused',
    }, 404);
  }

  try {
    const provider = await getProvider();
    const resumed = await provider.resumeEnvironment(preview.snapshotId);
    
    // Update preview state
    Object.assign(preview, resumed, {
      status: 'running',
      pausedAt: undefined,
      lastAccessedAt: new Date(),
      updatedAt: new Date(),
    });
    
    return c.json<PreviewResponse>({
      success: true,
      data: preview,
    });
  } catch (error) {
    return c.json<PreviewResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume environment',
    }, 500);
  }
});

// Get preview status
preview.get('/status/:id', async (c) => {
  const { id } = c.req.param();
  
  const preview = previewEnvironments.get(id);
  if (!preview) {
    return c.json<PreviewResponse>({
      success: false,
      error: 'Preview environment not found',
    }, 404);
  }

  try {
    // Check actual instance status if running
    if (preview.status === 'running' && preview.morphInstanceId) {
      const provider = await getProvider();
      const actualStatus = await provider.getInstanceStatus(preview.morphInstanceId);
      if (actualStatus !== 'running') {
        preview.status = actualStatus === 'stopped' ? 'paused' : 'error';
        preview.updatedAt = new Date();
      }
    }
    
    return c.json<PreviewResponse>({
      success: true,
      data: preview,
    });
  } catch (error) {
    return c.json<PreviewResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    }, 500);
  }
});

// Stop preview environment
preview.post('/stop/:id', async (c) => {
  const { id } = c.req.param();
  
  const preview = previewEnvironments.get(id);
  if (!preview) {
    return c.json<PreviewResponse>({
      success: false,
      error: 'Preview environment not found',
    }, 404);
  }

  try {
    if (preview.morphInstanceId) {
      const provider = await getProvider();
      await provider.stopInstance(preview.morphInstanceId);
    }
    
    // Update preview state
    preview.status = 'terminated';
    preview.updatedAt = new Date();
    
    // Remove from active previews after a delay
    setTimeout(() => previewEnvironments.delete(id), 60000); // 1 minute
    
    return c.json<PreviewResponse>({
      success: true,
      data: { message: 'Environment stopped successfully' },
    });
  } catch (error) {
    return c.json<PreviewResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop environment',
    }, 500);
  }
});

// Execute command in preview environment
preview.post('/exec', async (c) => {
  const { instanceId, command } = await c.req.json<{ instanceId: string; command: string }>();
  
  if (!instanceId || !command) {
    return c.json<PreviewResponse>({
      success: false,
      error: 'Instance ID and command are required',
    }, 400);
  }

  const preview = previewEnvironments.get(instanceId);
  if (!preview) {
    return c.json<PreviewResponse>({
      success: false,
      error: 'Preview environment not found',
    }, 404);
  }

  try {
    // Use the morphInstanceId from the preview environment
    const morphInstanceId = preview.morphInstanceId || instanceId;
    const provider = await getProvider();
    const result = await provider.exec(morphInstanceId, command);
    
    return c.json<PreviewResponse>({
      success: true,
      data: result,
    });
  } catch (error) {
    return c.json<PreviewResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute command',
    }, 500);
  }
});

// Set base snapshot ID (for testing)
preview.post('/set-base-snapshot', async (c) => {
  const { snapshotId } = await c.req.json<{ snapshotId: string }>();
  
  if (!snapshotId) {
    return c.json<PreviewResponse>({
      success: false,
      error: 'Snapshot ID is required',
    }, 400);
  }
  
  const provider = await getProvider();
  provider.setBaseSnapshotId(snapshotId);
  
  return c.json<PreviewResponse>({
    success: true,
    data: { message: 'Base snapshot ID set successfully' },
  });
});

export default preview;