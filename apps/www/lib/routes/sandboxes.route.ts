import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { getConvex } from "@/lib/utils/get-convex";
import { stackServerAppJs } from "@/lib/utils/stack";
import { verifyTeamAccess } from "@/lib/utils/team-verification";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { DEFAULT_MORPH_SNAPSHOT_ID } from "@/lib/utils/morph-defaults";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { MorphCloudClient } from "morphcloud";
import {
  generateGitHubInstallationToken,
  getInstallationForRepo,
} from "@/lib/utils/github-app-token";

export const sandboxesRouter = new OpenAPIHono();

const StartSandboxBody = z
  .object({
    teamSlugOrId: z.string(),
    snapshotId: z.string().optional(),
    ttlSeconds: z.number().optional().default(20 * 60),
    metadata: z.record(z.string(), z.string()).optional(),
    // Optional hydration parameters to clone a repo into the sandbox on start
    repoUrl: z.string().optional(),
    branch: z.string().optional(),
    newBranch: z.string().optional(),
    depth: z.number().optional().default(1),
  })
  .openapi("StartSandboxBody");

const StartSandboxResponse = z
  .object({
    instanceId: z.string(),
    vscodeUrl: z.string(),
    workerUrl: z.string(),
    provider: z.enum(["morph"]).default("morph"),
  })
  .openapi("StartSandboxResponse");

// Start a new sandbox (currently Morph-backed)
sandboxesRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/sandboxes/start",
    tags: ["Sandboxes"],
    summary: "Start a sandbox environment (Morph-backed)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartSandboxBody,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: StartSandboxResponse,
          },
        },
        description: "Sandbox started successfully",
      },
      401: { description: "Unauthorized" },
      500: { description: "Failed to start sandbox" },
    },
  }),
  async (c) => {
    // Require authentication
    const user = await stackServerAppJs.getUser({ tokenStore: c.req.raw });
    if (!user) return c.text("Unauthorized", 401);

    const body = c.req.valid("json");

    try {
      // Verify team access
      const team = await verifyTeamAccess({
        req: c.req.raw,
        teamSlugOrId: body.teamSlugOrId,
      });

      const client = new MorphCloudClient({ apiKey: env.MORPH_API_KEY });
      const instance = await client.instances.start({
        snapshotId: body.snapshotId || DEFAULT_MORPH_SNAPSHOT_ID,
        ttlSeconds: body.ttlSeconds ?? 20 * 60,
        ttlAction: "pause",
        metadata: {
          app: "cmux",
          teamId: team.uuid,
          ...(body.metadata || {}),
        },
      });

      const exposed = instance.networking.httpServices;
      const vscodeService = exposed.find((s) => s.port === 39378);
      const workerService = exposed.find((s) => s.port === 39377);
      if (!vscodeService || !workerService) {
        await instance.stop().catch(() => {});
        return c.text("VSCode or worker service not found", 500);
      }

      // Configure git identity from Convex users table so commits don't fail
      try {
        const accessToken = await getAccessTokenFromRequest(c.req.raw);
        if (accessToken) {
          const convex = getConvex({ accessToken });
          const who = await convex.query(api.users.getCurrentBasic, {});

          const name = (who?.displayName || "cmux").trim();
          // Prefer primary email; else construct a GitHub-style noreply address
          let email = (who?.primaryEmail || "").trim();
          if (!email) {
            const baseUser = name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "") || "cmux";
            const ghId = (who as unknown as { githubAccountId?: string | null })
              .githubAccountId;
            email = ghId
              ? `${ghId}+${baseUser}@users.noreply.github.com`
              : `${baseUser}@users.noreply.github.com`;
          }

          // Safe single-quote for shell (we'll wrap the whole -lc string in double quotes)
          const shq = (v: string) => `'${v.replace(/'/g, "\\'")}'`;

          const gitCfgRes = await instance.exec(
            `bash -lc "git config --global user.name ${shq(name)} && git config --global user.email ${shq(email)} && git config --global init.defaultBranch main && echo NAME:$(git config --global --get user.name) && echo EMAIL:$(git config --global --get user.email) || true"`
          );
          console.log(
            `[sandboxes.start] git identity configured exit=${gitCfgRes.exit_code} (${name} <${email}>)`
          );
        } else {
          console.log(
            `[sandboxes.start] No access token; skipping git identity configuration`
          );
        }
      } catch (e) {
        console.log(
          `[sandboxes.start] Failed to configure git identity; continuing...`,
          e
        );
      }

      // Optional: Hydrate repo inside the sandbox
      if (body.repoUrl) {
        console.log(`[sandboxes.start] Hydrating repo for ${instance.id}`);
        const match = body.repoUrl.match(/github\.com\/?([^\s/]+)\/([^\s/.]+)(?:\.git)?/i);
        if (!match) {
          return c.text("Unsupported repo URL; expected GitHub URL", 400);
        }
        const owner = match[1]!;
        const repo = match[2]!;
        const repoFull = `${owner}/${repo}`;
        console.log(`[sandboxes.start] Parsed owner/repo: ${repoFull}`);

        try {
          const installationId = await getInstallationForRepo(repoFull);
          if (!installationId) {
            return c.text(
              `No GitHub App installation found for ${owner}. Install the app for this org/user.`,
              400
            );
          }
          console.log(`[sandboxes.start] installationId: ${installationId}`);
          const githubToken = await generateGitHubInstallationToken({
            installationId,
            repositories: [repoFull],
          });
          console.log(
            `[sandboxes.start] Generated GitHub token (len=${githubToken.length})`
          );

          // Best-effort envctl for compatibility with gh and other tools
          try {
            const envctlRes = await instance.exec(
              `envctl set GITHUB_TOKEN=${githubToken}`
            );
            console.log(
              `[sandboxes.start] envctl set exit=${envctlRes.exit_code} stderr=${(envctlRes.stderr || "").slice(0, 200)}`
            );
          } catch (_e) {
            console.log(
              `[sandboxes.start] envctl not available; continuing without it`
            );
          }

          // gh auth for CLI tools
          const ghRes = await instance.exec(
            `bash -lc "echo '${githubToken}' | gh auth login --with-token 2>&1 || true"`
          );
          console.log(
            `[sandboxes.start] gh auth login exit=${ghRes.exit_code} stderr=${(ghRes.stderr || "").slice(0,200)}`
          );

          // Git credential store for HTTPS operations
          const credRes = await instance.exec(
            `bash -lc "git config --global credential.helper store && printf '%s\\n' 'https://x-access-token:${githubToken}@github.com' > /root/.git-credentials && (git config --global --get credential.helper || true) && (test -f /root/.git-credentials && wc -c /root/.git-credentials || true)"`
          );
          console.log(
            `[sandboxes.start] git creds configured exit=${credRes.exit_code} out=${(credRes.stdout||'').replace(/:[^@]*@/g, ':***@').slice(0,200)}`
          );

          const depth = body.depth ?? 1;
          const workspace = "/root/workspace";
          await instance.exec(`mkdir -p ${workspace}`);

          // Check remote
          const remoteRes = await instance.exec(
            `bash -lc "cd ${workspace} && test -d .git && git remote get-url origin || echo 'no-remote'"`
          );
          const remoteUrl = (remoteRes.stdout || "").trim();

          if (!remoteUrl || !remoteUrl.includes(`${owner}/${repo}`)) {
            await instance.exec(
              `bash -lc "rm -rf ${workspace}/* ${workspace}/.[!.]* ${workspace}/..?* 2>/dev/null || true"`
            );
            const maskedUrl = `https://x-access-token:***@github.com/${owner}/${repo}.git`;
            console.log(
              `[sandboxes.start] Cloning ${maskedUrl} depth=${depth} -> ${workspace}`
            );
            const cloneRes = await instance.exec(
              `bash -lc "git clone --depth ${depth} https://x-access-token:${githubToken}@github.com/${owner}/${repo}.git ${workspace}"`
            );
            console.log(
              `[sandboxes.start] clone exit=${cloneRes.exit_code} stderr=${(cloneRes.stderr||'').slice(0,300)}`
            );
            if (cloneRes.exit_code !== 0) {
              return c.text("Failed to clone repository", 500);
            }
          } else {
            const fetchRes = await instance.exec(
              `bash -lc "cd ${workspace} && git fetch --all --prune"`
            );
            console.log(
              `[sandboxes.start] fetch exit=${fetchRes.exit_code} stderr=${(fetchRes.stderr||'').slice(0,200)}`
            );
          }

          const baseBranch = body.branch || "main";
          const coRes = await instance.exec(
            `bash -lc "cd ${workspace} && (git checkout ${baseBranch} || git checkout -b ${baseBranch} origin/${baseBranch}) && git pull --ff-only || true"`
          );
          console.log(
            `[sandboxes.start] checkout ${baseBranch} exit=${coRes.exit_code} stderr=${(coRes.stderr||'').slice(0,200)}`
          );
          if (body.newBranch) {
            const nbRes = await instance.exec(
              `bash -lc "cd ${workspace} && git switch -C ${body.newBranch}"`
            );
            console.log(
              `[sandboxes.start] switch -C ${body.newBranch} exit=${nbRes.exit_code} stderr=${(nbRes.stderr||'').slice(0,200)}`
            );
          }

          const lsRes = await instance.exec(
            `bash -lc "ls -la ${workspace} | head -50"`
          );
          console.log(
            `[sandboxes.start] workspace listing:\n${lsRes.stdout || ''}`
          );
        } catch (e) {
          console.error(`[sandboxes.start] Hydration failed:`, e);
          await instance.stop().catch(() => {});
          return c.text("Failed to hydrate sandbox", 500);
        }
      }

      return c.json({
        instanceId: instance.id,
        vscodeUrl: vscodeService.url,
        workerUrl: workerService.url,
        provider: "morph",
      });
    } catch (error) {
      console.error("Failed to start sandbox:", error);
      return c.text("Failed to start sandbox", 500);
    }
  }
);

// Stop/pause a sandbox
sandboxesRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/sandboxes/{id}/stop",
    tags: ["Sandboxes"],
    summary: "Stop or pause a sandbox instance",
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      204: { description: "Sandbox stopped" },
      401: { description: "Unauthorized" },
      404: { description: "Not found" },
      500: { description: "Failed to stop sandbox" },
    },
  }),
  async (c) => {
    const id = c.req.valid("param").id;
    const token = await getAccessTokenFromRequest(c.req.raw);
    if (!token) return c.text("Unauthorized", 401);

    try {
      const client = new MorphCloudClient({ apiKey: env.MORPH_API_KEY });
      const instance = await client.instances.get({ instanceId: id });
      await instance.pause();
      return c.body(null, 204);
    } catch (error) {
      console.error("Failed to stop sandbox:", error);
      return c.text("Failed to stop sandbox", 500);
    }
  }
);

// Query status of sandbox
sandboxesRouter.openapi(
  createRoute({
    method: "get" as const,
    path: "/sandboxes/{id}/status",
    tags: ["Sandboxes"],
    summary: "Get sandbox status and URLs",
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              running: z.boolean(),
              vscodeUrl: z.string().optional(),
              workerUrl: z.string().optional(),
              provider: z.enum(["morph"]).optional(),
            }),
          },
        },
        description: "Sandbox status",
      },
      401: { description: "Unauthorized" },
      500: { description: "Failed to get status" },
    },
  }),
  async (c) => {
    const id = c.req.valid("param").id;
    const token = await getAccessTokenFromRequest(c.req.raw);
    if (!token) return c.text("Unauthorized", 401);
    try {
      const client = new MorphCloudClient({ apiKey: env.MORPH_API_KEY });
      const instance = await client.instances.get({ instanceId: id });
      const vscodeService = instance.networking.httpServices.find(
        (s) => s.port === 39378
      );
      const workerService = instance.networking.httpServices.find(
        (s) => s.port === 39377
      );
      const running = Boolean(vscodeService);
      return c.json({
        running,
        vscodeUrl: vscodeService?.url,
        workerUrl: workerService?.url,
        provider: "morph",
      });
    } catch (error) {
      console.error("Failed to get sandbox status:", error);
      return c.text("Failed to get status", 500);
    }
  }
);


// Publish devcontainer forwarded ports (read devcontainer.json inside instance, expose, persist to Convex)
sandboxesRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/sandboxes/{id}/publish-devcontainer",
    tags: ["Sandboxes"],
    summary:
      "Expose forwarded ports from devcontainer.json and persist networking info",
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              teamSlugOrId: z.string(),
              taskRunId: z.string(),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                status: z.enum(["running"]).default("running"),
                port: z.number(),
                url: z.string(),
              })
            ),
          },
        },
        description: "Exposed ports list",
      },
      401: { description: "Unauthorized" },
      500: { description: "Failed to publish devcontainer networking" },
    },
  }),
  async (c) => {
    const token = await getAccessTokenFromRequest(c.req.raw);
    if (!token) return c.text("Unauthorized", 401);
    const { id } = c.req.valid("param");
    const { teamSlugOrId, taskRunId } = c.req.valid("json");
    try {
      const client = new MorphCloudClient({ apiKey: env.MORPH_API_KEY });
      const instance = await client.instances.get({ instanceId: id });

      const CMUX_PORTS = new Set([39376, 39377, 39378]);
      // Attempt to read devcontainer.json
      const devcontainerJson = await instance.exec(
        "cat /root/workspace/.devcontainer/devcontainer.json"
      );
      if (devcontainerJson.exit_code !== 0) {
        return c.text("devcontainer.json not found", 200);
      }
      const parsed = JSON.parse(devcontainerJson.stdout || "{}") as {
        forwardPorts?: number[];
      };
      const ports = Array.isArray(parsed.forwardPorts)
        ? (parsed.forwardPorts as number[])
        : [];
      // Validate ports and avoid CMUX ports
      for (const p of ports) {
        if (CMUX_PORTS.has(p)) {
          return c.text(`Port ${p} is reserved by cmux`, 400);
        }
      }
      // Expose ports
      for (const p of ports) {
        try {
          await instance.exposeHttpService(`port-${p}` as const, p);
        } catch {
          // continue exposing other ports
        }
      }

      // Build networking list
      const networking = instance.networking.httpServices
        .filter((s) => !CMUX_PORTS.has(s.port))
        .map((s) => ({ status: "running" as const, port: s.port, url: s.url }));

      // Persist to Convex
      const convex = getConvex({ accessToken: token });
      await convex.mutation(api.taskRuns.updateNetworking, {
        teamSlugOrId,
        id: taskRunId as unknown as string & { __tableName: "taskRuns" },
        networking,
      });

      return c.json(networking);
    } catch (error) {
      console.error("Failed to publish devcontainer networking:", error);
      return c.text("Failed to publish devcontainer networking", 500);
    }
  }
);
