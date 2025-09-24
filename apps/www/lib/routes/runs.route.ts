import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

export const runsRouter = new OpenAPIHono();

const ResumeRunRequestSchema = z
  .object({
    teamSlugOrId: z.string(),
    taskRunId: z.string(),
    theme: z.enum(["dark", "light", "system"]).optional(),
  })
  .openapi("ResumeRunRequest");

const PortsSchema = z
  .object({
    vscode: z.string().optional(),
    worker: z.string().optional(),
    extension: z.string().optional(),
  })
  .partial()
  .openapi("ResumeRunPorts");

const ResumeRunSuccessSchema = z
  .object({
    success: z.literal(true),
    workspaceUrl: z.string(),
    url: z.string(),
    provider: z.enum(["docker", "morph", "daytona", "other"]).default("docker"),
    ports: PortsSchema.nullable().optional(),
  })
  .openapi("ResumeRunSuccess");

const ResumeRunErrorSchema = z
  .object({
    success: z.literal(false),
    error: z.string(),
  })
  .openapi("ResumeRunError");

const ResumeRunResponseSchema = z
  .union([ResumeRunSuccessSchema, ResumeRunErrorSchema])
  .openapi("ResumeRunResponse");

runsRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/runs/resume",
    tags: ["Runs"],
    summary: "Resume a VSCode session using persisted volumes",
    request: {
      body: {
        content: {
          "application/json": {
            schema: ResumeRunRequestSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ResumeRunResponseSchema,
          },
        },
        description: "Resume run result",
      },
      401: { description: "Unauthorized" },
      500: { description: "Failed to resume run" },
    },
  }),
  async (c) => {
    const token = await getAccessTokenFromRequest(c.req.raw);
    if (!token) {
      return c.text("Unauthorized", 401);
    }

    const body = c.req.valid("json");
    const baseUrl = process.env.CMUX_SERVER_BASE_URL ?? "http://localhost:9776";
    const targetUrl = new URL("/api/runs/resume", baseUrl);

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-stack-auth": token,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Failed to resume run");
        return c.json(
          {
            success: false,
            error: errorText || "Failed to resume run",
          },
          response.status
        );
      }

      const payload = await response.json();
      const parsed = ResumeRunResponseSchema.safeParse(payload);
      if (!parsed.success) {
        return c.json(
          { success: false, error: "Malformed resume run response" },
          500
        );
      }

      return c.json(parsed.data, 200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to resume run";
      return c.json({ success: false, error: message }, 500);
    }
  }
);
