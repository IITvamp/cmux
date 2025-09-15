import { createRoute, z } from "@hono/zod-openapi";
import { OpenAPIHono } from "@hono/zod-openapi";
import { api } from "@/lib/convex";
import { internal } from "convex/_generated/api";

export const githubWebhookRouter = new OpenAPIHono();

const headersSchema = z.object({
  "x-github-delivery": z.string(),
  "x-github-event": z.string(),
  "x-hub-signature-256": z.string().optional(),
  "x-github-hook-installation-target-id": z.string().optional(),
});

githubWebhookRouter.openapi(
  createRoute({
    method: "post",
    path: "/github/webhook",
    request: {
      headers: headersSchema,
      body: {
        content: {
          "application/json": {
            schema: z.any(),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Webhook received",
      },
    },
  }),
  async (c) => {
    const h = c.req.header();
    const deliveryId = h["x-github-delivery"]!;
    const event = h["x-github-event"]!;
    const body = await c.req.json<any>();
    const raw = await c.req.text(); // cannot read twice; but hono buffers; fallback to JSON hash
    const payloadString = typeof body === "string" ? body : JSON.stringify(body);
    const payloadHash = await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(payloadString))
      .then((b) => Buffer.from(new Uint8Array(b)).toString("hex"));

    const installationId = body?.installation?.id as number | undefined;

    const idempotent = await api.mutation(internal.github_webhook.recordWebhookDelivery, {
      provider: "github",
      deliveryId,
      installationId,
      payloadHash,
    });
    if (idempotent.alreadyProcessed) {
      return c.json({ ok: true, deduped: true });
    }

    try {
      if (event === "workflow_run" && body?.action) {
        const run = body.workflow_run;
        const repoFullName = `${body.repository.owner.login}/${body.repository.name}`;
        await api.mutation(internal.github_webhook.upsertWorkflowRun, {
          installationId: body.installation.id,
          repoFullName,
          repositoryId: body.repository.id,
          run,
        });
      } else if (event === "check_run" && body?.action) {
        const check = body.check_run;
        const repoFullName = `${body.repository.owner.login}/${body.repository.name}`;
        await api.mutation(internal.github_webhook.upsertCheckRun, {
          installationId: body.installation.id,
          repoFullName,
          repositoryId: body.repository.id,
          check,
        });
      }
    } catch (e) {
      console.error("Failed to process webhook:", e);
    }
    return c.json({ ok: true });
  }
);

