import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

// In-memory storage for comments
const commentsStore = new Map<string, Comment>();

// Comment schema
const CommentSchema = z.object({
  id: z.string(),
  text: z.string(),
  nodeId: z.string(),
  x: z.number(),
  y: z.number(),
  page: z.string(),
  pageTitle: z.string(),
  userAgent: z.string(),
  screenWidth: z.number(),
  screenHeight: z.number(),
  devicePixelRatio: z.number(),
  userId: z.string(),
  userName: z.string(),
  timestamp: z.string(),
  resolved: z.boolean().optional(),
});

const CommentInputSchema = CommentSchema.omit({ id: true });

type Comment = z.infer<typeof CommentSchema>;
type CommentInput = z.infer<typeof CommentInputSchema>;

// Routes
const getCommentsRoute = createRoute({
  method: "get",
  path: "/comments",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            comments: z.array(CommentSchema),
          }),
        },
      },
      description: "List of comments",
    },
  },
  tags: ["Comments"],
  summary: "Get all comments",
});

const createCommentRoute = createRoute({
  method: "post",
  path: "/comments",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CommentInputSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: CommentSchema,
        },
      },
      description: "Created comment",
    },
  },
  tags: ["Comments"],
  summary: "Create a new comment",
});

const getCommentRoute = createRoute({
  method: "get",
  path: "/comments/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CommentSchema,
        },
      },
      description: "Comment details",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
      description: "Comment not found",
    },
  },
  tags: ["Comments"],
  summary: "Get a comment by ID",
});

const updateCommentRoute = createRoute({
  method: "patch",
  path: "/comments/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            text: z.string().optional(),
            resolved: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CommentSchema,
        },
      },
      description: "Updated comment",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
      description: "Comment not found",
    },
  },
  tags: ["Comments"],
  summary: "Update a comment",
});

const deleteCommentRoute = createRoute({
  method: "delete",
  path: "/comments/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    204: {
      description: "Comment deleted",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
      description: "Comment not found",
    },
  },
  tags: ["Comments"],
  summary: "Delete a comment",
});

// Router
export const commentsRouter = new OpenAPIHono()
  .openapi(getCommentsRoute, (c) => {
    const comments = Array.from(commentsStore.values());
    return c.json({ comments });
  })
  .openapi(createCommentRoute, (c) => {
    const input = c.req.valid("json");
    const id = generateId();
    const comment: Comment = {
      ...input,
      id,
      resolved: false,
    };
    commentsStore.set(id, comment);
    return c.json(comment, 201);
  })
  .openapi(getCommentRoute, (c) => {
    const { id } = c.req.valid("param");
    const comment = commentsStore.get(id);
    if (!comment) {
      return c.json({ message: "Comment not found" }, 404);
    }
    return c.json(comment);
  })
  .openapi(updateCommentRoute, (c) => {
    const { id } = c.req.valid("param");
    const updates = c.req.valid("json");
    const comment = commentsStore.get(id);
    if (!comment) {
      return c.json({ message: "Comment not found" }, 404);
    }
    const updatedComment = { ...comment, ...updates };
    commentsStore.set(id, updatedComment);
    return c.json(updatedComment);
  })
  .openapi(deleteCommentRoute, (c) => {
    const { id } = c.req.valid("param");
    if (!commentsStore.has(id)) {
      return c.json({ message: "Comment not found" }, 404);
    }
    commentsStore.delete(id);
    return c.body(null, 204);
  });

// Utility function to generate random ID
function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}