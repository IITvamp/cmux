import { getConvex } from "@/lib/utils/get-convex";
import { selectGitIdentity } from "@/lib/utils/gitIdentity";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { createRoute, z } from "@hono/zod-openapi";
import { MorphCloudClient } from "morphcloud";
import { loadEnvironmentEnvVars } from "./environment";
import {
  configureGithubAccess,
  configureGitIdentity,
  fetchGitIdentityInputs,
} from "./git";
import type { HydrateRepoConfig } from "./hydration";
import { hydrateWorkspace } from "./hydration";
import { resolveTeamAndSnapshot } from "./snapshot";
import {
  encodeEnvContentForEnvctl,
  envctlLoadCommand,
} from "../utils/ensure-env-vars";

export interface PreSpawnedSandbox {
  instanceId: string;
  vscodeUrl: string;
  workerUrl: string;
  provider: "morph";
  createdAt: number;
  teamId: string;
  environmentId?: string;
  snapshotId?: string;
}

export interface CreateSandboxOptions {
  teamSlugOrId: string;
  environmentId?: string;
  snapshotId?: string;
  ttlSeconds?: number;
  metadata?: Record<string, string>;
  taskRunId?: string;
  taskRunJwt?: string;
  repoUrl?: string;
  branch?: string;
  newBranch?: string;
  depth?: number;
  req: Request;
  accessToken: string;
  githubAccessToken: string;
}

export async function createSandbox(
  options: CreateSandboxOptions,
): Promise<PreSpawnedSandbox> {
  const {
    teamSlugOrId,
    environmentId,
    snapshotId,
    ttlSeconds = 20 * 60,
    metadata = {},
    taskRunId,
    taskRunJwt,
    repoUrl,
    branch,
    newBranch,
    depth = 1,
    req,
    accessToken,
    githubAccessToken,
  } = options;

  const convex = getConvex({ accessToken });

  const { team, resolvedSnapshotId, environmentDataVaultKey } =
    await resolveTeamAndSnapshot({
      req,
      convex,
      teamSlugOrId,
      environmentId,
      snapshotId,
    });

  const environmentEnvVarsPromise = environmentDataVaultKey
    ? loadEnvironmentEnvVars(environmentDataVaultKey)
    : Promise.resolve<string | null>(null);

  const gitIdentityPromise = fetchGitIdentityInputs(convex, githubAccessToken);

  const client = new MorphCloudClient({ apiKey: env.MORPH_API_KEY });
  const instance = await client.instances.start({
    snapshotId: resolvedSnapshotId,
    ttlSeconds,
    ttlAction: "pause",
    metadata: {
      app: "cmux",
      teamId: team.uuid,
      ...(environmentId ? { environmentId } : {}),
      ...metadata,
    },
  });

  const exposed = instance.networking.httpServices;
  const vscodeService = exposed.find((s) => s.port === 39378);
  const workerService = exposed.find((s) => s.port === 39377);
  if (!vscodeService || !workerService) {
    await instance.stop().catch(() => {});
    throw new Error("VSCode or worker service not found");
  }

  // Get environment variables from the environment if configured
  const environmentEnvVarsContent = await environmentEnvVarsPromise;

  // Prepare environment variables including task JWT if present
  let envVarsToApply = environmentEnvVarsContent || "";

  // Add CMUX task-related env vars if present
  if (taskRunId) {
    envVarsToApply += `\nCMUX_TASK_RUN_ID="${taskRunId}"`;
  }
  if (taskRunJwt) {
    envVarsToApply += `\nCMUX_TASK_RUN_JWT="${taskRunJwt}"`;
  }

  // Apply all environment variables if any
  if (envVarsToApply.trim().length > 0) {
    try {
      const encodedEnv = encodeEnvContentForEnvctl(envVarsToApply);
      const loadRes = await instance.exec(envctlLoadCommand(encodedEnv));
      if (loadRes.exit_code === 0) {
        console.log(
          `[sandboxes.createSandbox] Applied environment variables via envctl`,
          {
            hasEnvironmentVars: Boolean(environmentEnvVarsContent),
            hasTaskRunId: Boolean(taskRunId),
            hasTaskRunJwt: Boolean(taskRunJwt),
          },
        );
      } else {
        console.error(
          `[sandboxes.createSandbox] Env var bootstrap failed exit=${loadRes.exit_code} stderr=${(loadRes.stderr || "").slice(0, 200)}`,
        );
      }
    } catch (error) {
      console.error(
        "[sandboxes.createSandbox] Failed to apply environment variables",
        error,
      );
    }
  }

  const configureGitIdentityTask = gitIdentityPromise
    .then(([who, gh]: any) => {
      const { name, email } = selectGitIdentity(who, gh);
      return configureGitIdentity(instance, { name, email });
    })
    .catch((error: any) => {
      console.log(
        `[sandboxes.createSandbox] Failed to configure git identity; continuing...`,
        error,
      );
    });

  // Sandboxes run as the requesting user, so prefer their OAuth scope over GitHub App installation tokens.
  await configureGithubAccess(instance, githubAccessToken);

  let repoConfig: HydrateRepoConfig | undefined;
  if (repoUrl) {
    console.log(`[sandboxes.createSandbox] Hydrating repo for ${instance.id}`);
    const match = repoUrl.match(
      /github\.com\/?([^\s/]+)\/([^\s/.]+)(?:\.git)?/i,
    );
    if (!match) {
      throw new Error("Unsupported repo URL; expected GitHub URL");
    }
    const owner = match[1]!;
    const name = match[2]!;
    const repoFull = `${owner}/${name}`;
    console.log(`[sandboxes.createSandbox] Parsed owner/repo: ${repoFull}`);

    repoConfig = {
      owner,
      name,
      repoFull,
      cloneUrl: `https://github.com/${owner}/${name}.git`,
      maskedCloneUrl: `https://github.com/${owner}/${name}.git`,
      depth: Math.max(1, Math.floor(depth)),
      baseBranch: branch || "main",
      newBranch: newBranch ?? "",
    };
  }

  try {
    await hydrateWorkspace({
      instance,
      repo: repoConfig,
    });
  } catch (error) {
    console.error(`[sandboxes.createSandbox] Hydration failed:`, error);
    await instance.stop().catch(() => {});
    throw new Error("Failed to hydrate sandbox");
  }

  await configureGitIdentityTask;

  return {
    instanceId: instance.id,
    vscodeUrl: vscodeService.url,
    workerUrl: workerService.url,
    provider: "morph",
    createdAt: Date.now(),
    teamId: team.uuid,
    environmentId,
    snapshotId,
  };
}
