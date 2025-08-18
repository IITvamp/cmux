import { handle } from 'hono/nextjs';
import { OpenAPIHono } from '@hono/zod-openapi';
import { app as commentsApp } from '../../internal/commentsOpenApiApp';

// We re-use the same OpenAPI instance to expose the spec here.
const app = new OpenAPIHono();

// Mount the comments app at /api/comments for spec collection
app.route('/comments', commentsApp);

app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: { title: 'cmux Comments API', version: '1.0.0' },
});

export const GET = handle(app);

