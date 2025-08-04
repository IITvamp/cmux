import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/error-handler.js';
import preview from './routes/preview.js';
import health from './routes/health.js';
import { previewStream } from './routes/preview-stream.js';

// Load environment variables
dotenv.config();

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());
app.use('*', errorHandler);

// Routes
app.route('/api/preview', preview);
app.route('/api/preview-stream', previewStream);
app.route('/api/health', health);

// Default route
app.get('/', (c) => {
  return c.json({
    message: 'cmux Preview Service',
    version: '1.0.0',
    endpoints: [
      'POST /api/preview/create',
      'POST /api/preview-stream/create (SSE)',
      'POST /api/preview/pause/:id',
      'POST /api/preview/resume/:id',
      'GET /api/preview/status/:id',
      'POST /api/preview/stop/:id',
      'GET /api/health',
    ],
  });
});

const port = process.env.PORT || 3001;

serve({
  fetch: app.fetch,
  port: Number(port),
}, (info) => {
  console.log(`Preview service running on http://localhost:${info.port}`);
});