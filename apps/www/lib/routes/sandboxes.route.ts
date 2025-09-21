import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { getConvex } from "@/lib/utils/get-convex";
import {
  generateGitHubInstallationToken,
  getInstallationForRepo,
} from "@/lib/utils/github-app-token";
import { fetchGithubUserInfoForRequest } from "@/lib/utils/githubUserInfo";
import { selectGitIdentity } from "@/lib/utils/gitIdentity";
import { DEFAULT_MORPH_SNAPSHOT_ID } from "@/lib/utils/morph-defaults";
import { stackServerAppJs } from "@/lib/utils/stack";
import { verifyTeamAccess } from "@/lib/utils/team-verification";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { MorphCloudClient } from "morphcloud";
import {
  encodeEnvContentForEnvctl,
  envctlLoadCommand,
} from "./utils/ensure-env-vars";
import { runBackgroundTask } from "./utils/run-background-task";

const WORKSPACE_PATH = "/root/workspace" as const;

const shellQuote = (value: string): string =>
  `'${value.replace(/'/g, `'"'"'`)}'`;

const maskSensitiveValue = (
  input: string | undefined | null,
  secret: string | null
): string => {
  if (!input) return "";
  if (!secret) return input;
  return input.split(secret).join("***");
};

type RepoScriptOptions = {
  repoFull: string;
  githubToken: string;
  depth: number;
  baseBranch: string;
  newBranch?: string;
};

const buildPrimaryRepoScript = ({
  repoFull,
  githubToken,
  depth,
  baseBranch,
  newBranch,
}: RepoScriptOptions): string => {
  const credentialUrl = `https://x-access-token:${githubToken}@github.com`;
  const cloneUrl = `https://x-access-token:${githubToken}@github.com/${repoFull}.git`;
  const repoRemote = `https://github.com/${repoFull}.git`;

  const lines: string[] = [
    "set -euo pipefail",
    `workspace=${shellQuote(WORKSPACE_PATH)}`,
    'mkdir -p "$workspace"',
    "git config --global credential.helper store",
    `printf '%s\\n' ${shellQuote(credentialUrl)} > /root/.git-credentials`,
    "chmod 600 /root/.git-credentials 2>/dev/null || true",
    `repo_remote=${shellQuote(repoRemote)}`,
    `clone_url=${shellQuote(cloneUrl)}`,
    'if [ ! -d "$workspace/.git" ]; then',
    '  find "$workspace" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true',
    `  git clone --depth ${depth} "$clone_url" "$workspace"`,
    "else",
    '  existing_remote=$(git -C "$workspace" remote get-url origin 2>/dev/null || echo "")',
    '  if [ "$existing_remote" != "$repo_remote" ]; then',
    '    find "$workspace" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true',
    `    git clone --depth ${depth} "$clone_url" "$workspace"`,
    "  else",
    '    git -C "$workspace" remote set-url origin "$repo_remote"',
    "  fi",
    "fi",
    'if [ ! -d "$workspace/.git" ]; then',
    '  echo "[sandboxes.start] Repository clone failed" >&2',
    "  exit 1",
    "fi",
    'git -C "$workspace" remote set-url origin "$repo_remote"',
    'unset clone_url',
    'git -C "$workspace" fetch --tags --prune --prune-tags origin',
    `base_branch=${shellQuote(baseBranch)}`,
    'if git -C "$workspace" show-ref --verify --quiet "refs/heads/$base_branch"; then',
    '  git -C "$workspace" checkout "$base_branch"',
    'elif git -C "$workspace" show-ref --verify --quiet "refs/remotes/origin/$base_branch"; then',
    '  git -C "$workspace" checkout -B "$base_branch" "origin/$base_branch"',
    "else",
    '  git -C "$workspace" checkout -B "$base_branch"',
    "fi",
    'if git -C "$workspace" rev-parse --verify --quiet "origin/$base_branch"; then',
    '  git -C "$workspace" pull --ff-only origin "$base_branch"',
    "fi",
  ];

  if (newBranch) {
    lines.push(`new_branch=${shellQuote(newBranch)}`);
    lines.push('git -C "$workspace" switch -C "$new_branch"');
  }

  lines.push("exit 0");

  return lines.join("\n");
};

type GitIdentity = {
  name: string;
  email: string;
};

const buildWorkspaceRefreshCommand = (): string =>
  [
    `if [ -d ${shellQuote(WORKSPACE_PATH)} ]; then`,
    `  for dir in ${shellQuote(WORKSPACE_PATH)}/*; do`,
    '    [ -d "$dir" ] || continue',
    '    if [ -d "$dir/.git" ]; then',
    '      echo "[sandboxes.start] git pull in $dir"',
    '      (cd "$dir" && git pull --ff-only || true) &',
    '    else',
    '      echo "[sandboxes.start] skipping $dir (no git repo)"',
    '    fi',
    "  done",
    '  wait || true',
    "else",
    `  echo "[sandboxes.start] ${WORKSPACE_PATH} missing"`,
    "fi",
  ].join("\n");

type BackgroundScriptOptions = {
  envctlEncoded?: string | null;
  githubToken?: string | null;
  gitIdentity?: GitIdentity | null;
};

const buildBackgroundScript = ({
  envctlEncoded,
  githubToken,
  gitIdentity,
}: BackgroundScriptOptions): string | null => {
  const tasks: Array<{ description: string; command: string }> = [];

  if (envctlEncoded) {
    tasks.push({
      description: "apply environment env vars",
      command: envctlLoadCommand(envctlEncoded),
    });
  }

  if (githubToken) {
    tasks.push({
      description: "envctl set GITHUB_TOKEN",
      command: `envctl set GITHUB_TOKEN=${shellQuote(githubToken)}`,
    });
    tasks.push({
      description: "gh auth login",
      command: `printf '%s\\n' ${shellQuote(githubToken)} | gh auth login --with-token >/dev/null 2>&1`,
    });
  }

  if (gitIdentity) {
    tasks.push({
      description: "configure git identity",
      command: `git config --global user.name ${shellQuote(gitIdentity.name)} && git config --global user.email ${shellQuote(gitIdentity.email)} && git config --global init.defaultBranch main`,
    });
  }

  tasks.push({
    description: "refresh workspace git repositories",
    command: buildWorkspaceRefreshCommand(),
  });

  if (tasks.length === 0) {
    return null;
  }

  const lines: string[] = [
    "set -euo pipefail",
    'pids=()'
  ];

  lines.push(
    'run_task() {',
    '  local desc="$1"',
    '  local cmd="$2"',
    '  (',
    '    set -euo pipefail',
    '    if bash -lc "$cmd"; then',
    '      echo "[sandboxes.start] ${desc} completed"',
    '    else',
    '      status=$?',
    '      echo "[sandboxes.start] ${desc} failed (exit=${status})" >&2',
    '    fi',
    '  ) &',
    '  pids+=("$!")',
    '}'
  );

  for (const task of tasks) {
    lines.push(
      `run_task ${shellQuote(task.description)} ${shellQuote(task.command)}`
    );
  }

  lines.push('if [ "${#pids[@]}" -gt 0 ]; then');
  lines.push('  wait "${pids[@]}" || true');
  lines.push("fi");
  lines.push("exit 0");

  return lines.join("\n");
};

export const sandboxesRouter = new OpenAPIHono();

const StartSandboxBody = z
  .object({
    teamSlugOrId: z.string(),
    environmentId: z.string().optional(),
    snapshotId: z.string().optional(),
    ttlSeconds: z
      .number()
      .optional()
      .default(20 * 60),
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

const UpdateSandboxEnvBody = z
  .object({
    teamSlugOrId: z.string(),
    envVarsContent: z.string(),
  })
  .openapi("UpdateSandboxEnvBody");

const UpdateSandboxEnvResponse = z
  .object({
    applied: z.literal(true),
  })
  .openapi("UpdateSandboxEnvResponse");

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
    // Require authentication (via access token header/cookie)
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);

    const body = c.req.valid("json");
    try {
      console.log("[sandboxes.start] incoming", {
        teamSlugOrId: body.teamSlugOrId,
        hasEnvId: Boolean(body.environmentId),
        hasSnapshotId: Boolean(body.snapshotId),
        repoUrl: body.repoUrl,
        branch: body.branch,
      });
    } catch {
      /* noop */
    }

    try {
      // Verify team access
      const team = await verifyTeamAccess({
        req: c.req.raw,
        teamSlugOrId: body.teamSlugOrId,
      });

      // Determine snapshotId with access checks
      const convex = getConvex({ accessToken });

      let resolvedSnapshotId: string | null = null;
      let environmentDataVaultKey: string | undefined;
      let environmentEnvVarsContentPromise: Promise<string | null> =
        Promise.resolve(null);

      if (body.environmentId) {
        const environmentId = typedZid("environments").parse(
          body.environmentId
        );
        // Verify the environment belongs to this team
        const envDoc = await convex.query(api.environments.get, {
          teamSlugOrId: body.teamSlugOrId,
          id: environmentId,
        });
        if (!envDoc) {
          return c.text("Environment not found or not accessible", 403);
        }
        resolvedSnapshotId = envDoc.morphSnapshotId;
        environmentDataVaultKey = envDoc.dataVaultKey;
      } else if (body.snapshotId) {
        // Ensure the provided snapshotId belongs to one of the team's environments
        const envs = await convex.query(api.environments.list, {
          teamSlugOrId: body.teamSlugOrId,
        });
        const match = envs.find((e) => e.morphSnapshotId === body.snapshotId);
        if (!match) {
          return c.text(
            "Forbidden: Snapshot does not belong to this team",
            403
          );
        }
        resolvedSnapshotId = match.morphSnapshotId;
      } else {
        // Fall back to default snapshot if nothing provided
        resolvedSnapshotId = DEFAULT_MORPH_SNAPSHOT_ID;
      }

      if (environmentDataVaultKey) {
        environmentEnvVarsContentPromise = (async () => {
          try {
            const store =
              await stackServerAppJs.getDataVaultStore("cmux-snapshot-envs");
            const content = await store.getValue(environmentDataVaultKey!, {
              secret: env.STACK_DATA_VAULT_SECRET,
            });
            try {
              const length = content?.length ?? 0;
              console.log(
                `[sandboxes.start] Loaded environment env vars (chars=${length})`
              );
            } catch {
              /* noop */
            }
            return content ?? null;
          } catch (error) {
            console.error(
              "[sandboxes.start] Failed to fetch environment env vars",
              error
            );
            return null;
          }
        })();
      }

      const gitIdentityDataPromise = accessToken
        ? (async () => {
            try {
              const [who, gh] = await Promise.all([
                convex.query(api.users.getCurrentBasic, {}),
                fetchGithubUserInfoForRequest(c.req.raw),
              ]);
              return selectGitIdentity(who, gh);
            } catch (error) {
              console.log(
                `[sandboxes.start] Failed to load git identity information`,
                error
              );
              return null;
            }
          })()
        : null;

      const client = new MorphCloudClient({ apiKey: env.MORPH_API_KEY });
      const [instance, environmentEnvVarsContent] = await Promise.all([
        client.instances.start({
          snapshotId: resolvedSnapshotId,
          ttlSeconds: body.ttlSeconds ?? 20 * 60,
          ttlAction: "pause",
          metadata: {
            app: "cmux",
            teamId: team.uuid,
            ...(body.environmentId ? { environmentId: body.environmentId } : {}),
            ...(body.metadata || {}),
          },
        }),
        environmentEnvVarsContentPromise,
      ]);

      const exposed = instance.networking.httpServices;
      const vscodeService = exposed.find((s) => s.port === 39378);
      const workerService = exposed.find((s) => s.port === 39377);
      if (!vscodeService || !workerService) {
        await instance.stop().catch(() => {});
        return c.text("VSCode or worker service not found", 500);
      }

      const envctlEncoded =
        environmentEnvVarsContent &&
        environmentEnvVarsContent.trim().length > 0
          ? encodeEnvContentForEnvctl(environmentEnvVarsContent)
          : null;

      let githubToken: string | null = null;
      let repoFull: string | null = null;

      if (body.repoUrl) {
        console.log(`[sandboxes.start] Hydrating repo for ${instance.id}`);
        const match = body.repoUrl.match(
          /github\.com\/?([^\s/]+)\/([^\s/.]+)(?:\.git)?/i
        );
        if (!match) {
          await instance.stop().catch(() => {});
          return c.text("Unsupported repo URL; expected GitHub URL", 400);
        }

        const owner = match[1]!;
        const repo = match[2]!;
        repoFull = `${owner}/${repo}`;
        console.log(`[sandboxes.start] Parsed owner/repo: ${repoFull}`);

        const installationId = await getInstallationForRepo(repoFull);
        if (!installationId) {
          await instance.stop().catch(() => {});
          return c.text(
            `No GitHub App installation found for ${owner}. Install the app for this org/user.`,
            400
          );
        }
        console.log(`[sandboxes.start] installationId: ${installationId}`);

        githubToken = await generateGitHubInstallationToken({
          installationId,
          repositories: [repoFull],
        });
        console.log(
          `[sandboxes.start] Generated GitHub token (len=${githubToken.length})`
        );

        const maskedCloneUrl = `https://x-access-token:***@github.com/${repoFull}.git`;
        console.log(
          `[sandboxes.start] Running repo setup script depth=${body.depth ?? 1} -> ${maskedCloneUrl}`
        );

        const primaryScript = buildPrimaryRepoScript({
          repoFull,
          githubToken,
          depth: body.depth ?? 1,
          baseBranch: body.branch || "main",
          newBranch: body.newBranch,
        });

        const primaryResult = await instance.exec(
          `bash -lc ${shellQuote(primaryScript)}`
        );

        const maskedStdout = maskSensitiveValue(primaryResult.stdout, githubToken);
        const maskedStderr = maskSensitiveValue(primaryResult.stderr, githubToken);

        if (maskedStdout) {
          console.log(
            `[sandboxes.start] repo setup stdout:\n${maskedStdout.slice(0, 4000)}`
          );
        }

        if (primaryResult.exit_code !== 0) {
          console.error(
            `[sandboxes.start] repo setup failed exit=${primaryResult.exit_code} stderr=${maskedStderr.slice(0, 4000)}`
          );
          await instance.stop().catch(() => {});
          return c.text("Failed to hydrate sandbox", 500);
        }

        if (maskedStderr) {
          console.log(
            `[sandboxes.start] repo setup stderr:\n${maskedStderr.slice(0, 4000)}`
          );
        }

        console.log(
          `[sandboxes.start] repo setup completed exit=${primaryResult.exit_code}`
        );
      }

      runBackgroundTask("post-start setup", async () => {
        const identity = gitIdentityDataPromise
          ? await gitIdentityDataPromise
          : null;

        const backgroundScript = buildBackgroundScript({
          envctlEncoded,
          githubToken,
          gitIdentity: identity,
        });

        if (!backgroundScript) {
          return;
        }

        const backgroundResult = await instance.exec(
          `bash -lc ${shellQuote(backgroundScript)}`
        );

        const maskedStdout = maskSensitiveValue(
          backgroundResult.stdout,
          githubToken
        );
        const maskedStderr = maskSensitiveValue(
          backgroundResult.stderr,
          githubToken
        );

        if (maskedStdout) {
          console.log(
            `[sandboxes.start] post-start script stdout:\n${maskedStdout.slice(0, 4000)}`
          );
        }

        if (backgroundResult.exit_code !== 0) {
          console.error(
            `[sandboxes.start] post-start script exit=${backgroundResult.exit_code} stderr=${maskedStderr.slice(0, 4000)}`
          );
          throw new Error(
            `post-start script failed with exit ${backgroundResult.exit_code}`
          );
        }

        if (maskedStderr) {
          console.log(
            `[sandboxes.start] post-start script stderr:\n${maskedStderr.slice(0, 4000)}`
          );
        }
      });

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

sandboxesRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/sandboxes/{id}/env",
    tags: ["Sandboxes"],
    summary: "Apply environment variables to a running sandbox",
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: UpdateSandboxEnvBody,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: UpdateSandboxEnvResponse,
          },
        },
        description: "Environment variables applied",
      },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Sandbox not found" },
      500: { description: "Failed to apply environment variables" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);

    const { id } = c.req.valid("param");
    const { teamSlugOrId, envVarsContent } = c.req.valid("json");

    try {
      const team = await verifyTeamAccess({
        req: c.req.raw,
        teamSlugOrId,
      });

      const client = new MorphCloudClient({ apiKey: env.MORPH_API_KEY });
      const instance = await client.instances
        .get({ instanceId: id })
        .catch((error) => {
          console.error("[sandboxes.env] Failed to load instance", error);
          return null;
        });

      if (!instance) {
        return c.text("Sandbox not found", 404);
      }

      const metadataTeamId = (
        instance as unknown as {
          metadata?: { teamId?: string };
        }
      ).metadata?.teamId;

      if (metadataTeamId && metadataTeamId !== team.uuid) {
        return c.text("Forbidden", 403);
      }

      const encodedEnv = encodeEnvContentForEnvctl(envVarsContent);
      const command = envctlLoadCommand(encodedEnv);
      const execResult = await instance.exec(command);
      if (execResult.exit_code !== 0) {
        console.error(
          `[sandboxes.env] envctl load failed exit=${execResult.exit_code} stderr=${(execResult.stderr || "").slice(0, 200)}`
        );
        return c.text("Failed to apply environment variables", 500);
      }

      return c.json({ applied: true as const });
    } catch (error) {
      console.error(
        "[sandboxes.env] Failed to apply environment variables",
        error
      );
      return c.text("Failed to apply environment variables", 500);
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

      // Attempt to read devcontainer.json for declared forwarded ports
      const devcontainerJson = await instance.exec(
        "cat /root/workspace/.devcontainer/devcontainer.json"
      );
      const parsed =
        devcontainerJson.exit_code === 0
          ? (JSON.parse(devcontainerJson.stdout || "{}") as {
              forwardPorts?: number[];
            })
          : { forwardPorts: [] as number[] };

      const devcontainerPorts = Array.isArray(parsed.forwardPorts)
        ? (parsed.forwardPorts as number[])
        : [];

      // Read environmentId from instance metadata (set during start)
      const instanceMeta = (
        instance as unknown as {
          metadata?: { environmentId?: string };
        }
      ).metadata;

      // Resolve environment-exposed ports (preferred)
      const convex = getConvex({ accessToken: token });
      let environmentPorts: number[] | undefined;
      if (instanceMeta?.environmentId) {
        try {
          const envDoc = await convex.query(api.environments.get, {
            teamSlugOrId,
            id: instanceMeta.environmentId as string & {
              __tableName: "environments";
            },
          });
          environmentPorts = envDoc?.exposedPorts ?? undefined;
        } catch {
          // ignore lookup errors; fall back to devcontainer ports
        }
      }

      // Build the set of ports we want to expose and persist
      const allowedPorts = new Set<number>();
      const addAllowed = (p: number) => {
        if (!Number.isFinite(p)) return;
        const pn = Math.floor(p);
        if (pn > 0 && !CMUX_PORTS.has(pn)) allowedPorts.add(pn);
      };

      // Prefer environment.exposedPorts if available; otherwise use devcontainer forwardPorts
      (environmentPorts && environmentPorts.length > 0
        ? environmentPorts
        : devcontainerPorts
      ).forEach(addAllowed);

      // Expose each allowed port in Morph (best-effort)
      await Promise.all(
        Array.from(allowedPorts).map(async (p) => {
          try {
            await instance.exposeHttpService(`port-${p}` as const, p);
          } catch {
            // continue exposing other ports
          }
        })
      );

      // Intersect exposed HTTP services with allowed ports
      const networking = instance.networking.httpServices
        .filter((s) => allowedPorts.has(s.port))
        .map((s) => ({ status: "running" as const, port: s.port, url: s.url }));

      // Persist to Convex
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
