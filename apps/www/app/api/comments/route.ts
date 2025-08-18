import { handle } from 'hono/nextjs';
import { app } from '../../internal/commentsOpenApiApp';

export const GET = handle(app);
export const POST = handle(app);
