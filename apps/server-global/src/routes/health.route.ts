import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const HealthSchema = z
  .object({
    status: z.enum(["healthy", "unhealthy"]).openapi({
      example: "healthy",
    }),
    timestamp: z.string().datetime().openapi({
      example: "2024-01-01T00:00:00Z",
    }),
    version: z.string().openapi({
      example: "1.0.0",
    }),
    uptime: z.number().openapi({
      example: 3600,
      description: "Uptime in seconds",
    }),
  })
  .openapi("Health");

const startTime = Date.now();

export const healthRouter = new OpenAPIHono();

healthRouter.openapi(
  createRoute({
    method: "get",
    path: "/health",
    tags: ["System"],
    summary: "Health check endpoint",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: HealthSchema,
          },
        },
        description: "Service is healthy",
      },
    },
  }),
  (c) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  
  return c.json({
    status: "healthy" as const,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    uptime,
  }, 200);
});