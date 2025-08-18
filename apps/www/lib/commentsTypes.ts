import { OpenAPIHono } from 'hono/zod-openapi';
import { z } from 'zod';

export const CommentSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  page: z.string(),
  pageTitle: z.string(),
  userAgent: z.string(),
  screenWidth: z.number(),
  screenHeight: z.number(),
  devicePixelRatio: z.number(),
});

export type CommentPayload = z.infer<typeof CommentSchema>;

export const CommentRecordSchema = CommentSchema.extend({
  createdAt: z.string(),
});

export type CommentRecord = z.infer<typeof CommentRecordSchema>;

export type AppWithOpenAPI = OpenAPIHono<{ Bindings: {} }>;

