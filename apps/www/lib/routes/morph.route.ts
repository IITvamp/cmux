import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { env } from "@/lib/utils/www-env";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { MorphCloudClient } from "morphcloud";

export const morphRouter = new OpenAPIHono();

const ProvisionInstanceBody = z
  .object({
    ttlSeconds: z.number().default(60 * 60 * 2), // 2 hours default
  })
  .openapi("ProvisionInstanceBody");

const ProvisionInstanceResponse = z
  .object({
    vscodeUrl: z.string(),
    instanceId: z.string(),
  })
  .openapi("ProvisionInstanceResponse");

morphRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/morph/provision-instance",
    tags: ["Morph"],
    summary: "Provision a Morph instance for environment configuration",
    request: {
      body: {
        content: {
          "application/json": {
            schema: ProvisionInstanceBody,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ProvisionInstanceResponse,
          },
        },
        description: "Instance provisioned successfully",
      },
      401: { description: "Unauthorized" },
      500: { description: "Failed to provision instance" },
    },
  }),
  async (c) => {
    // Require authentication
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);

    const { ttlSeconds } = c.req.valid("json");

    try {
      const client = new MorphCloudClient({
        apiKey: env.MORPH_API_KEY,
      });

      console.log("Starting Morph instance");
      const instance = await client.instances.start({
        snapshotId: "snapshot_hzlmd4kx",
        ttlSeconds,
        ttlAction: "pause",
        metadata: {
          app: "cmux-dev",
        },
      });

      const vscodeUrl = instance.networking.httpServices.find(
        (service) => service.port === 39378
      )?.url;

      if (!vscodeUrl) {
        throw new Error("VSCode URL not found");
      }

      const url = `${vscodeUrl}/?folder=/root/workspace`;
      console.log(`VSCode Workspace URL: ${url}`);

      return c.json({
        vscodeUrl: url,
        instanceId: instance.id,
      });
    } catch (error) {
      console.error("Failed to provision Morph instance:", error);
      return c.text("Failed to provision instance", 500);
    }
  }
);
