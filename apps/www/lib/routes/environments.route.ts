import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { stackServerApp } from "@/lib/utils/stack";
import { getConvex } from "../utils/get-convex";
import { randomUUID } from "node:crypto";

export const environmentsRouter = new OpenAPIHono();

const CreateEnvironmentBody = z
  .object({
    team: z.string().min(1).openapi({ description: "Team slug or UUID" }),
    name: z.string().min(1),
    morphSnapshotId: z.string().min(1),
    envFile: z.string().min(1).openapi({ description: ".env file contents" }),
  })
  .openapi("CreateEnvironmentBody");

const CreateEnvironmentResponse = z
  .object({
    environmentId: z.string(),
  })
  .openapi("CreateEnvironmentResponse");

environmentsRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/environments",
    tags: ["Environments"],
    summary: "Create a new team environment and store its .env securely",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateEnvironmentBody,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Environment created",
        content: {
          "application/json": { schema: CreateEnvironmentResponse },
        },
      },
      401: { description: "Unauthorized" },
      500: { description: "Failed to create environment" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);

    const { team, name, morphSnapshotId, envFile } = c.req.valid("json");

    try {
      // Store .env in Stack Auth Data Vault under a random key
      type DataVaultStore = {
        getValue: (key: string, opts: { secret: string }) => Promise<string | null>;
        setValue: (key: string, value: string, opts: { secret: string }) => Promise<void>;
      };
      const store = await (stackServerApp as unknown as {
        getDataVaultStore: (name: string) => Promise<DataVaultStore>;
      }).getDataVaultStore("cmux-snapshot-envs");
      const key = `env-${randomUUID()}`;
      await store.setValue(key, envFile, {
        secret: env.STACK_DATA_VAULT_SECRET,
      });

      // Create Convex environment metadata
      const convex = getConvex({ accessToken });
      const environmentId = await convex.mutation(api.environments.create, {
        teamSlugOrId: team,
        name,
        morphSnapshotId,
        dataVaultKey: key,
      });

      return c.json({ environmentId });
    } catch (error) {
      console.error("Failed to create environment:", error);
      return c.text("Failed to create environment", 500);
    }
  }
);
