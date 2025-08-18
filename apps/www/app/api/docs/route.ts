import { handle } from 'hono/nextjs';
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { app as commentsApp } from '../../internal/commentsOpenApiApp';

const app = new OpenAPIHono();

app.route('/comments', commentsApp);

app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: { title: 'cmux Comments API', version: '1.0.0' },
});

app.get('/', swaggerUI({ url: '/api/docs/openapi.json' }));

export const GET = handle(app);

