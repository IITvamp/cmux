import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { PreviewConfig } from '../types/index.js';
import { PreviewConfigSchema } from '../types/index.js';
import { ProviderFactory } from '../services/provider-factory.js';
import { previewEnvironments } from './preview.js';

const previewStream = new Hono();
const sandboxProvider = ProviderFactory.getProviderFromEnv();

// Create preview with streaming logs
previewStream.post('/create', async (c) => {
  const body = await c.req.json();
  const validation = PreviewConfigSchema.safeParse(body);
  
  if (!validation.success) {
    return c.json({
      success: false,
      error: validation.error.errors.map(e => e.message).join(', '),
    }, 400);
  }

  return stream(c, async (stream) => {
    await stream.write(`data: ${JSON.stringify({ type: 'start', message: 'Starting preview environment creation...' })}\n\n`);

    try {
      // Create log handler
      const logHandler = (message: string) => {
        stream.write(`data: ${JSON.stringify({ type: 'log', message })}

`).catch(() => {
          // Client disconnected
        });
      };

      // Set base snapshot
      const baseSnapshotId = process.env.MORPH_BASE_SNAPSHOT_ID || 'snapshot_7o3z2iez';
      sandboxProvider.setBaseSnapshotId(baseSnapshotId);

      // Create preview with log streaming
      const preview = await sandboxProvider.createPreviewEnvironmentWithLogs(
        validation.data,
        logHandler
      );
      
      // Store in memory
      previewEnvironments.set(preview.id, preview);

      await stream.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        preview: {
          id: preview.id,
          urls: preview.urls,
          status: preview.status,
        }
      })}

`);

    } catch (error) {
      await stream.write(`data: ${JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })}

`);
    }

    await stream.close();
  });
});

export { previewStream };