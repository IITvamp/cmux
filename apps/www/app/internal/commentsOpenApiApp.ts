import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { CommentRecordSchema, CommentSchema } from '../../lib/commentsTypes';
import { addComment, listCommentsByPage } from '../../lib/commentsStore';

export const app = new OpenAPIHono();

const QuerySchema = z.object({
  page: z.string().optional().openapi({ example: '/' }),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    request: { query: QuerySchema },
    responses: {
      200: {
        description: 'List comments',
        content: {
          'application/json': {
            schema: z.object({ comments: z.array(CommentRecordSchema) }),
          },
        },
      },
    },
    tags: ['comments'],
    operationId: 'listComments',
    summary: 'List comments optionally filtered by page',
  }),
  (c) => {
    const { page } = c.req.valid('query');
    const comments = listCommentsByPage(page);
    return c.json({ comments });
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CommentSchema,
            example: {
              id: '77HUQ',
              nodeId:
                'body>div>section>div>div:nth-of-type(2)>a:nth-of-type(2),body.__className_e8ce0c>div.min-h-screen>section.pt-24>div.max-w-4xl>div.flex:nth-of-type(2)>a.inline-flex:nth-of-type(2)',
              x: 0.7234354628422425,
              y: 0.483695652173913,
              page: '/',
              pageTitle: 'cmux - Orchestrate AI coding agents in parallel',
              userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
              screenWidth: 1763,
              screenHeight: 1328,
              devicePixelRatio: 2,
            },
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: 'Created comment',
        content: {
          'application/json': {
            schema: z.object({ comment: CommentRecordSchema }),
          },
        },
      },
    },
    tags: ['comments'],
    operationId: 'createComment',
    summary: 'Create a new comment',
  }),
  async (c) => {
    const payload = await c.req.json();
    const parsed = CommentSchema.safeParse(payload);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400);
    }
    const record = { ...parsed.data, createdAt: new Date().toISOString() };
    addComment(record);
    return c.json({ comment: record });
  },
);

