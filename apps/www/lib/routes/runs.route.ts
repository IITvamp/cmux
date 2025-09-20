import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { getConvex } from "@/lib/utils/get-convex";
import { verifyTeamAccess } from "@/lib/utils/team-verification";
import { api } from "@cmux/convex/api";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { typedZid } from "@cmux/shared/utils/typed-zid";

const execAsync = promisify(exec);

export const runsRouter = new OpenAPIHono();

const ResumeRunBody = z
  .object({
    teamSlugOrId: z.string(),
    runId: z.string(),
  })
  .openapi("ResumeRunBody");

const ResumeRunResponse = z
  .object({
    workspaceUrl: z.string(),
  })
  .openapi("ResumeRunResponse");

runsRouter.openapi(
  createRoute({
    method: "post",
    path: "/runs/resume",
    tags: ["Runs"],
    summary: "Resume a VSCode run (Docker)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: ResumeRunBody,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ResumeRunResponse,
          },
        },
        description: "Run resume initiated",
      },
      401: { description: "Unauthorized" },
      404: { description: "Run not found" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);
    const { teamSlugOrId, runId } = c.req.valid("json");

    await verifyTeamAccess({ req: c.req.raw, teamSlugOrId });
    const convex = getConvex({ accessToken });

    const run = await convex.query(api.taskRuns.get, {
      teamSlugOrId,
      id: typedZid("taskRuns").parse(runId),
    });
    if (!run) return c.text("Run not found", 404);

    const containerName = `cmux-${runId}`;
    const proxyBaseUrl = `http://${containerName}.vscode.localhost:9776?team=${encodeURIComponent(
      teamSlugOrId
    )}`;
    const workspaceUrl = `${proxyBaseUrl}&folder=${encodeURIComponent(
      "/root/workspace"
    )}`;

    // Update vscode URL and mark as warm/starting
    if (run.vscode) {
      await convex.mutation(api.taskRuns.updateVSCodeInstance, {
        teamSlugOrId,
        id: run._id,
        vscode: {
          ...run.vscode,
          provider: run.vscode.provider || "docker",
          containerName,
          status: run.vscode.status === "running" ? "running" : "starting",
          runState: "active",
          url: proxyBaseUrl,
          workspaceUrl,
          lastActivityAt: Date.now(),
        },
      });
    }

    // Kick the proxy to (re)start the container in background; ignore errors
    try {
      void fetch(`${proxyBaseUrl}`);
    } catch {
      /* noop */
    }

    return c.json({ workspaceUrl });
  }
);

const TerminateRunBody = z
  .object({
    teamSlugOrId: z.string(),
    runId: z.string(),
  })
  .openapi("TerminateRunBody");

const TerminateRunResponse = z
  .object({
    terminated: z.literal(true),
  })
  .openapi("TerminateRunResponse");

runsRouter.openapi(
  createRoute({
    method: "post",
    path: "/runs/terminate",
    tags: ["Runs"],
    summary: "Terminate a VSCode run and remove volumes (Docker)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: TerminateRunBody,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: TerminateRunResponse,
          },
        },
        description: "Run terminated",
      },
      401: { description: "Unauthorized" },
      404: { description: "Run not found" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);
    const { teamSlugOrId, runId } = c.req.valid("json");

    await verifyTeamAccess({ req: c.req.raw, teamSlugOrId });
    const convex = getConvex({ accessToken });

    const run = await convex.query(api.taskRuns.get, {
      teamSlugOrId,
      id: typedZid("taskRuns").parse(runId),
    });
    if (!run) return c.text("Run not found", 404);

    const containerName = `cmux-${runId}`;
    const vscodeVol = run.vscode?.vscodeVolume || `cmux_session_${runId}_vscode`;
    const workspaceVol = run.vscode?.workspaceVolume;

    // Best-effort: stop and remove container & volumes
    try {
      await execAsync(`docker rm -f ${containerName}`);
    } catch {
      /* ignore */
    }
    try {
      await execAsync(`docker volume rm -f ${vscodeVol}`);
    } catch {
      /* ignore */
    }
    if (workspaceVol) {
      try {
        await execAsync(`docker volume rm -f ${workspaceVol}`);
      } catch {
        /* ignore */
      }
    }

    if (run.vscode) {
      await convex.mutation(api.taskRuns.updateVSCodeInstance, {
        teamSlugOrId,
        id: run._id,
        vscode: {
          ...run.vscode,
          status: "stopped",
          runState: "terminated",
          stoppedAt: Date.now(),
          lastActivityAt: Date.now(),
        },
      });
    }

    return c.json({ terminated: true });
  }
);
