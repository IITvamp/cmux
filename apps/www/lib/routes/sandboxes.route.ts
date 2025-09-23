import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { getConvex } from "@/lib/utils/get-convex";
import { fetchGithubUserInfoForRequest } from "@/lib/utils/githubUserInfo";
import { selectGitIdentity } from "@/lib/utils/gitIdentity";
import { DEFAULT_MORPH_SNAPSHOT_ID } from "@/lib/utils/morph-defaults";
import { stackServerAppJs } from "@/lib/utils/stack";
import { verifyTeamAccess } from "@/lib/utils/team-verification";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { MorphCloudClient } from "morphcloud";
import {
  encodeEnvContentForEnvctl,
  envctlLoadCommand,
} from "./utils/ensure-env-vars";

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

const singleQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;
const maskSensitive = (value: string) => value.replace(/:[^@]*@/g, ":***@");
const MORPH_WORKSPACE_PATH = "/root/workspace";

type MorphInstance = Awaited<
  ReturnType<MorphCloudClient["instances"]["start"]>
>;

type ConvexClient = ReturnType<typeof getConvex>;

interface SnapshotResolution {
  team: Awaited<ReturnType<typeof verifyTeamAccess>>;
  resolvedSnapshotId: string;
  environmentDataVaultKey?: string;
}

const resolveTeamAndSnapshot = async ({
  req,
  convex,
  teamSlugOrId,
  environmentId,
  snapshotId,
}: {
  req: Request;
  convex: ConvexClient;
  teamSlugOrId: string;
  environmentId?: string;
  snapshotId?: string;
}): Promise<SnapshotResolution> => {
  const team = await verifyTeamAccess({ req, teamSlugOrId });

  if (environmentId) {
    const environmentDoc = await convex.query(api.environments.get, {
      teamSlugOrId,
      id: typedZid("environments").parse(environmentId),
    });

    if (!environmentDoc) {
      throw new HTTPException(403, {
        message: "Environment not found or not accessible",
      });
    }

    return {
      team,
      resolvedSnapshotId:
        environmentDoc.morphSnapshotId || DEFAULT_MORPH_SNAPSHOT_ID,
      environmentDataVaultKey: environmentDoc.dataVaultKey ?? undefined,
    };
  }

  if (snapshotId) {
    const environments = await convex.query(api.environments.list, {
      teamSlugOrId,
    });
    const matchedEnvironment = environments.find(
      (environment) => environment.morphSnapshotId === snapshotId
    );

    if (!matchedEnvironment) {
      throw new HTTPException(403, {
        message: "Forbidden: Snapshot does not belong to this team",
      });
    }

    return {
      team,
      resolvedSnapshotId:
        matchedEnvironment.morphSnapshotId || DEFAULT_MORPH_SNAPSHOT_ID,
    };
  }

  return {
    team,
    resolvedSnapshotId: DEFAULT_MORPH_SNAPSHOT_ID,
  };
};

const loadEnvironmentEnvVars = async (
  dataVaultKey: string
): Promise<string | null> => {
  try {
    const store =
      await stackServerAppJs.getDataVaultStore("cmux-snapshot-envs");
    const content = await store.getValue(dataVaultKey, {
      secret: env.STACK_DATA_VAULT_SECRET,
    });
    const length = content?.length ?? 0;
    console.log(
      `[sandboxes.start] Loaded environment env vars (chars=${length})`
    );
    return content;
  } catch (error) {
    console.error(
      "[sandboxes.start] Failed to fetch environment env vars",
      error
    );
    return null;
  }
};

const fetchGitIdentityInputs = (convex: ConvexClient, req: Request) =>
  Promise.all([
    convex.query(api.users.getCurrentBasic, {}),
    fetchGithubUserInfoForRequest(req),
  ] as const);

const configureGitIdentity = async (
  instance: MorphInstance,
  identity: { name: string; email: string }
) => {
  const gitCfgRes = await instance.exec(
    `bash -lc "git config --global user.name ${singleQuote(identity.name)} && git config --global user.email ${singleQuote(identity.email)} && git config --global init.defaultBranch main && echo NAME:$(git config --global --get user.name) && echo EMAIL:$(git config --global --get user.email) || true"`
  );
  console.log(
    `[sandboxes.start] git identity configured exit=${gitCfgRes.exit_code} (${identity.name} <${identity.email}>)`
  );
};

const configureGithubAccess = async (
  instance: MorphInstance,
  token: string
) => {
  try {
    const [envctlRes, ghAuthRes] = await Promise.all([
      instance.exec(`envctl set GITHUB_TOKEN=${token}`),
      instance.exec(
        `bash -lc "printf %s ${singleQuote(token)} | gh auth login --with-token && gh auth setup-git 2>&1 || true"`
      ),
    ]);

    console.log(
      `[sandboxes.start] envctl set exit=${envctlRes.exit_code} stderr=${maskSensitive(
        envctlRes.stderr || ""
      ).slice(0, 200)}`
    );
    console.log(
      `[sandboxes.start] gh auth exit=${ghAuthRes.exit_code} stderr=${maskSensitive(
        ghAuthRes.stderr || ""
      ).slice(0, 200)}`
    );
  } catch (error) {
    console.error("[sandboxes.start] GitHub auth bootstrap failed", error);
  }
};

interface HydrateRepoConfig {
  owner: string;
  name: string;
  repoFull: string;
  cloneUrl: string;
  maskedCloneUrl: string;
  depth: number;
  baseBranch: string;
  newBranch: string;
}

const createHydrateScript = ({
  workspacePath,
  repo,
}: {
  workspacePath: string;
  repo?: HydrateRepoConfig;
}): string => {
  const lines: string[] = [
    "set -euo pipefail",
    "",
    `WORKSPACE=${singleQuote(workspacePath)}`,
    "",
    'mkdir -p "$WORKSPACE"',
    "",
  ];

  if (repo) {
    lines.push(
      `OWNER=${singleQuote(repo.owner)}`,
      `REPO=${singleQuote(repo.name)}`,
      `REPO_FULL=${singleQuote(repo.repoFull)}`,
      `CLONE_URL=${singleQuote(repo.cloneUrl)}`,
      `MASKED_CLONE_URL=${singleQuote(repo.maskedCloneUrl)}`,
      `BASE_BRANCH=${singleQuote(repo.baseBranch)}`,
      `NEW_BRANCH=${singleQuote(repo.newBranch)}`,
      `DEPTH=${repo.depth}`,
      "",
      'REMOTE=""',
      'if [ -d "$WORKSPACE/.git" ]; then',
      '  REMOTE=$(cd "$WORKSPACE" && git remote get-url origin || echo "")',
      "fi",
      "",
      'if [ -n "$REMOTE" ] && ! printf \'%s\' "$REMOTE" | grep -q "$OWNER/$REPO"; then',
      '  echo "[sandboxes.start] remote mismatch; clearing workspace"',
      '  rm -rf "$WORKSPACE"/* "$WORKSPACE"/.[!.]* "$WORKSPACE"/..?* 2>/dev/null || true',
      "fi",
      "",
      'if [ ! -d "$WORKSPACE/.git" ]; then',
      '  echo "[sandboxes.start] Cloning $MASKED_CLONE_URL depth=$DEPTH -> $WORKSPACE"',
      '  git clone --depth $DEPTH "$CLONE_URL" "$WORKSPACE"',
      "else",
      '  echo "[sandboxes.start] Fetching updates for $REPO_FULL"',
      '  (cd "$WORKSPACE" && git fetch --all --prune || true)',
      "fi",
      "",
      "(",
      '  cd "$WORKSPACE"',
      '  (git checkout "$BASE_BRANCH" || git checkout -b "$BASE_BRANCH" "origin/$BASE_BRANCH") && git pull --ff-only || true',
      '  if [ -n "$NEW_BRANCH" ]; then',
      '    git switch -C "$NEW_BRANCH" || true',
      "  fi",
      "  ls -la | head -50",
      ")",
      ""
    );
  }

  lines.push(
    'if [ -d "$WORKSPACE" ]; then',
    '  for dir in "$WORKSPACE"/*; do',
    '    [ -d "$dir" ] || continue',
    '    if [ -d "$dir/.git" ]; then',
    '      echo "[sandboxes.start] git pull in $dir"',
    '      (cd "$dir" && git pull --ff-only || true) &',
    "    else",
    '      echo "[sandboxes.start] skipping $dir (no git repo)"',
    "    fi",
    "  done",
    "  wait || true",
    "else",
    '  echo "[sandboxes.start] $WORKSPACE missing"',
    "fi"
  );

  return lines.join("\n");
};

const hydrateWorkspace = async ({
  instance,
  repo,
}: {
  instance: MorphInstance;
  repo?: HydrateRepoConfig;
}): Promise<void> => {
  const script = createHydrateScript({
    workspacePath: MORPH_WORKSPACE_PATH,
    repo,
  });

  const hydrateRes = await instance.exec(`bash -lc ${singleQuote(script)}`);
  const maskedStdout = maskSensitive(hydrateRes.stdout || "").slice(0, 500);
  if (maskedStdout) {
    console.log(`[sandboxes.start] hydration stdout:\n${maskedStdout}`);
  }
  console.log(
    `[sandboxes.start] hydration exit=${hydrateRes.exit_code} stderr=${maskSensitive(
      hydrateRes.stderr || ""
    ).slice(0, 200)}`
  );

  if (hydrateRes.exit_code !== 0) {
    throw new Error("Hydration failed");
  }
};

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
    const user = await stackServerAppJs.getUser({ tokenStore: c.req.raw });
    if (!user) {
      return c.text("Unauthorized", 401);
    }
    const { accessToken } = await user.getAuthJson();
    if (!accessToken) {
      return c.text("Unauthorized", 401);
    }
    const githubAccessTokenPromise = (async () => {
      const githubAccount = await user.getConnectedAccount("github");
      if (!githubAccount) {
        return {
          githubAccessTokenError: "GitHub account not found",
          githubAccessToken: null,
        } as const;
      }
      const { accessToken: githubAccessToken } =
        await githubAccount.getAccessToken();
      if (!githubAccessToken) {
        return {
          githubAccessTokenError: "GitHub access token not found",
          githubAccessToken: null,
        } as const;
      }

      return { githubAccessTokenError: null, githubAccessToken } as const;
    })();

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
      const convex = getConvex({ accessToken });

      const { team, resolvedSnapshotId, environmentDataVaultKey } =
        await resolveTeamAndSnapshot({
          req: c.req.raw,
          convex,
          teamSlugOrId: body.teamSlugOrId,
          environmentId: body.environmentId,
          snapshotId: body.snapshotId,
        });

      const environmentEnvVarsPromise = environmentDataVaultKey
        ? loadEnvironmentEnvVars(environmentDataVaultKey)
        : Promise.resolve<string | null>(null);

      const gitIdentityPromise = fetchGitIdentityInputs(convex, c.req.raw);

      const client = new MorphCloudClient({ apiKey: env.MORPH_API_KEY });
      const instance = await client.instances.start({
        snapshotId: resolvedSnapshotId,
        ttlSeconds: body.ttlSeconds ?? 20 * 60,
        ttlAction: "pause",
        metadata: {
          app: "cmux",
          teamId: team.uuid,
          ...(body.environmentId ? { environmentId: body.environmentId } : {}),
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

      const environmentEnvVarsContent = await environmentEnvVarsPromise;
      if (
        environmentEnvVarsContent &&
        environmentEnvVarsContent.trim().length > 0
      ) {
        try {
          const encodedEnv = encodeEnvContentForEnvctl(
            environmentEnvVarsContent
          );
          const loadRes = await instance.exec(envctlLoadCommand(encodedEnv));
          if (loadRes.exit_code === 0) {
            console.log(
              `[sandboxes.start] Applied environment env vars via envctl`
            );
          } else {
            console.error(
              `[sandboxes.start] Env var bootstrap failed exit=${loadRes.exit_code} stderr=${(loadRes.stderr || "").slice(0, 200)}`
            );
          }
        } catch (error) {
          console.error(
            "[sandboxes.start] Failed to apply environment env vars",
            error
          );
        }
      }

      const configureGitIdentityTask = gitIdentityPromise
        .then(([who, gh]) => {
          const { name, email } = selectGitIdentity(who, gh);
          return configureGitIdentity(instance, { name, email });
        })
        .catch((error) => {
          console.log(
            `[sandboxes.start] Failed to configure git identity; continuing...`,
            error
          );
        });

      const { githubAccessToken, githubAccessTokenError } =
        await githubAccessTokenPromise;
      if (githubAccessTokenError) {
        console.error(
          `[sandboxes.start] GitHub access token error: ${githubAccessTokenError}`
        );
        return c.text("Failed to resolve GitHub credentials", 401);
      }

      // Sandboxes run as the requesting user, so prefer their OAuth scope over GitHub App installation tokens.
      await configureGithubAccess(instance, githubAccessToken);

      let repoConfig: HydrateRepoConfig | undefined;
      if (body.repoUrl) {
        console.log(`[sandboxes.start] Hydrating repo for ${instance.id}`);
        const match = body.repoUrl.match(
          /github\.com\/?([^\s/]+)\/([^\s/.]+)(?:\.git)?/i
        );
        if (!match) {
          return c.text("Unsupported repo URL; expected GitHub URL", 400);
        }
        const owner = match[1]!;
        const name = match[2]!;
        const repoFull = `${owner}/${name}`;
        console.log(`[sandboxes.start] Parsed owner/repo: ${repoFull}`);

        repoConfig = {
          owner,
          name,
          repoFull,
          cloneUrl: `https://x-access-token:${githubAccessToken}@github.com/${owner}/${name}.git`,
          maskedCloneUrl: `https://x-access-token:***@github.com/${owner}/${name}.git`,
          depth: Math.max(1, Math.floor(body.depth ?? 1)),
          baseBranch: body.branch || "main",
          newBranch: body.newBranch ?? "",
        };
      }

      try {
        await hydrateWorkspace({
          instance,
          repo: repoConfig,
        });
      } catch (error) {
        console.error(`[sandboxes.start] Hydration failed:`, error);
        await instance.stop().catch(() => {});
        return c.text("Failed to hydrate sandbox", 500);
      }

      await configureGitIdentityTask;

      return c.json({
        instanceId: instance.id,
        vscodeUrl: vscodeService.url,
        workerUrl: workerService.url,
        provider: "morph",
      });
    } catch (error) {
      if (error instanceof HTTPException) {
        const message =
          typeof error.message === "string" && error.message.length > 0
            ? error.message
            : "Request failed";
        return c.text(message, error.status);
      }
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
