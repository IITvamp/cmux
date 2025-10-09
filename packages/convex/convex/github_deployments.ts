import { v } from "convex/values";
import { getTeamId } from "../_shared/team";
import { internalMutation } from "./_generated/server";
import { authQuery } from "./users/utils";

const timestampValue = v.union(v.string(), v.number());

export type DeploymentWebhookPayload = {
  deploymentId?: number;
  sha?: string;
  ref?: string;
  task?: string;
  environment?: string;
  description?: string;
  creatorLogin?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
  repositoryId?: number;
};

export type DeploymentStatusWebhookPayload = {
  deploymentId?: number;
  sha?: string;
  state?: string;
  description?: string;
  logUrl?: string;
  targetUrl?: string;
  environmentUrl?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
  ref?: string;
  task?: string;
  environment?: string;
  creatorLogin?: string;
  repositoryId?: number;
};

function normalizeTimestamp(
  value: string | number | null | undefined,
): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return value > 1000000000000 ? value : value * 1000;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export const upsertDeploymentFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    teamId: v.string(),
    payload: v.object({
      deploymentId: v.optional(v.number()),
      sha: v.optional(v.string()),
      ref: v.optional(v.string()),
      task: v.optional(v.string()),
      environment: v.optional(v.string()),
      description: v.optional(v.string()),
      creatorLogin: v.optional(v.string()),
      createdAt: v.optional(timestampValue),
      updatedAt: v.optional(timestampValue),
      repositoryId: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const { installationId, repoFullName, teamId, payload } = args;


    const deploymentId = payload.deploymentId;
    const sha = payload.sha;

    if (!deploymentId || !sha) {
      console.warn("[upsertDeployment] Missing required fields", {
        deploymentId,
        sha,
        repoFullName,
        teamId,
      });
      return;
    }

    const createdAt = normalizeTimestamp(payload.createdAt);
    const updatedAt = normalizeTimestamp(payload.updatedAt);

    const deploymentDoc = {
      provider: "github" as const,
      installationId,
      repositoryId: payload.repositoryId,
      repoFullName,
      deploymentId,
      teamId,
      sha,
      ref: payload.ref ?? undefined,
      task: payload.task ?? undefined,
      environment: payload.environment ?? undefined,
      description: payload.description ?? undefined,
      creatorLogin: payload.creatorLogin,
      createdAt,
      updatedAt,
      state: undefined,
      statusDescription: undefined,
      targetUrl: undefined,
      environmentUrl: undefined,
      triggeringPrNumber: undefined,
    };


    const existingRecords = await ctx.db
      .query("githubDeployments")
      .withIndex("by_deploymentId", (q) => q.eq("deploymentId", deploymentId))
      .collect();

    if (existingRecords.length > 0) {
      await ctx.db.patch(existingRecords[0]._id, deploymentDoc);

      if (existingRecords.length > 1) {
        console.warn("[upsertDeployment] Found duplicates, cleaning up", {
          deploymentId,
          count: existingRecords.length,
          duplicateIds: existingRecords.slice(1).map(r => r._id),
        });
        for (const duplicate of existingRecords.slice(1)) {
          await ctx.db.delete(duplicate._id);
        }
      }
    } else {
      await ctx.db.insert("githubDeployments", deploymentDoc);
    }
  },
});

export const updateDeploymentStatusFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    teamId: v.string(),
    payload: v.object({
      deploymentId: v.optional(v.number()),
      sha: v.optional(v.string()),
      state: v.optional(v.string()),
      description: v.optional(v.string()),
      logUrl: v.optional(v.string()),
      targetUrl: v.optional(v.string()),
      environmentUrl: v.optional(v.string()),
      createdAt: v.optional(timestampValue),
      updatedAt: v.optional(timestampValue),
      ref: v.optional(v.string()),
      task: v.optional(v.string()),
      environment: v.optional(v.string()),
      creatorLogin: v.optional(v.string()),
      repositoryId: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const { installationId, repoFullName, teamId, payload } = args;


    const deploymentId = payload.deploymentId;
    const state = payload.state;

    if (!deploymentId) {
      console.warn("[updateDeploymentStatus] Missing deploymentId", {
        repoFullName,
        teamId,
      });
      return;
    }

    const validStates = ["error", "failure", "pending", "in_progress", "queued", "success"] as const;
    type ValidState = typeof validStates[number];
    const isValidState = (s: string): s is ValidState => validStates.includes(s as ValidState);
    const normalizedState: ValidState | undefined = state && isValidState(state) ? state : undefined;

    const updatedAt = normalizeTimestamp(payload.updatedAt);

    const existingRecords = await ctx.db
      .query("githubDeployments")
      .withIndex("by_deploymentId", (q) => q.eq("deploymentId", deploymentId))
      .collect();

    if (existingRecords.length > 0) {
      await ctx.db.patch(existingRecords[0]._id, {
        state: normalizedState,
        statusDescription: payload.description ?? undefined,
        logUrl: payload.logUrl ?? undefined,
        targetUrl: payload.targetUrl ?? undefined,
        environmentUrl: payload.environmentUrl ?? undefined,
        updatedAt,
      });

      if (existingRecords.length > 1) {
        console.warn("[updateDeploymentStatus] Found duplicates, cleaning up", {
          deploymentId,
          count: existingRecords.length,
          duplicateIds: existingRecords.slice(1).map(r => r._id),
        });
        for (const duplicate of existingRecords.slice(1)) {
          await ctx.db.delete(duplicate._id);
        }
      }
    } else {
      const sha = payload.sha;
      if (!sha) {
        console.warn("[updateDeploymentStatus] Deployment not found and no SHA available", {
          deploymentId,
          repoFullName,
          teamId,
        });
        return;
      }

      const createdAt = normalizeTimestamp(payload.createdAt);

      const deploymentDoc = {
        provider: "github" as const,
        installationId,
        repositoryId: payload.repositoryId,
        repoFullName,
        deploymentId,
        teamId,
        sha,
        ref: payload.ref ?? undefined,
        task: payload.task ?? undefined,
        environment: payload.environment ?? undefined,
        description: payload.description ?? undefined,
        creatorLogin: payload.creatorLogin,
        createdAt,
        updatedAt,
        state: normalizedState,
        statusDescription: payload.description ?? undefined,
        logUrl: payload.logUrl ?? undefined,
        targetUrl: payload.targetUrl ?? undefined,
        environmentUrl: payload.environmentUrl ?? undefined,
        triggeringPrNumber: undefined,
      };

      await ctx.db.insert("githubDeployments", deploymentDoc);
    }
  },
});

export const getDeploymentsForPr = authQuery({
  args: {
    teamSlugOrId: v.string(),
    repoFullName: v.string(),
    prNumber: v.number(),
    headSha: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { teamSlugOrId, repoFullName, headSha, limit = 20 } = args;
    const teamId = await getTeamId(ctx, teamSlugOrId);


    const allDeploymentsForRepo = await ctx.db
      .query("githubDeployments")
      .withIndex("by_team_repo", (q) =>
        q.eq("teamId", teamId).eq("repoFullName", repoFullName),
      )
      .collect();

    const filtered = allDeploymentsForRepo
      .filter((deployment) => {
        if (headSha) {
          return deployment.sha === headSha;
        }
        return deployment.triggeringPrNumber === args.prNumber;
      })
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    // Deduplicate by environment, keeping the most recently updated one
    const dedupMap = new Map<string, typeof filtered[number]>();
    for (const deployment of filtered) {
      const key = deployment.environment || deployment.task || 'default';
      const existing = dedupMap.get(key);
      if (!existing || (deployment.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
        dedupMap.set(key, deployment);
      }
    }
    const deployments = Array.from(dedupMap.values()).slice(0, limit);


    return deployments;
  },
});
