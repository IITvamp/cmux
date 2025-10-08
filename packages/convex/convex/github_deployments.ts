import { v } from "convex/values";
import { getTeamId } from "../_shared/team";
import { internalMutation } from "./_generated/server";
import { authQuery, authMutation } from "./users/utils";
import type {
  DeploymentEvent,
  DeploymentStatusEvent,
} from "@octokit/webhooks-types";

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
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const payload = args.payload as DeploymentEvent;
    const { installationId, repoFullName, teamId } = args;

    console.log("[upsertDeployment] Starting", {
      teamId,
      repoFullName,
      installationId,
    });

    const deploymentId = payload.deployment?.id;
    const sha = payload.deployment?.sha;

    if (!deploymentId || !sha) {
      console.warn("[upsertDeployment] Missing required fields", {
        deploymentId,
        sha,
        repoFullName,
        teamId,
      });
      return;
    }

    const createdAt = normalizeTimestamp(payload.deployment?.created_at);
    const updatedAt = normalizeTimestamp(payload.deployment?.updated_at);

    const deploymentDoc = {
      provider: "github" as const,
      installationId,
      repositoryId: payload.repository?.id,
      repoFullName,
      deploymentId,
      teamId,
      sha,
      ref: payload.deployment?.ref ?? undefined,
      task: payload.deployment?.task ?? undefined,
      environment: payload.deployment?.environment ?? undefined,
      description: payload.deployment?.description ?? undefined,
      creatorLogin: payload.deployment?.creator?.login,
      createdAt,
      updatedAt,
      state: undefined,
      statusDescription: undefined,
      targetUrl: undefined,
      environmentUrl: undefined,
      triggeringPrNumber: undefined,
    };

    console.log("[upsertDeployment] Prepared document", {
      deploymentId,
      sha,
      environment: deploymentDoc.environment,
      teamId,
      repoFullName,
    });

    const existing = await ctx.db
      .query("githubDeployments")
      .withIndex("by_deploymentId")
      .filter((q) => q.eq(q.field("deploymentId"), deploymentId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, deploymentDoc);
      console.log("[upsertDeployment] Updated deployment", {
        _id: existing._id,
        deploymentId,
        repoFullName,
      });
    } else {
      const newId = await ctx.db.insert("githubDeployments", deploymentDoc);
      console.log("[upsertDeployment] Inserted deployment", {
        _id: newId,
        deploymentId,
        repoFullName,
      });
    }
  },
});

export const updateDeploymentStatusFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    teamId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const payload = args.payload as DeploymentStatusEvent;
    const { installationId, repoFullName, teamId } = args;

    console.log("[updateDeploymentStatus] Starting", {
      teamId,
      repoFullName,
      installationId,
      state: payload.deployment_status?.state,
    });

    const deploymentId = payload.deployment?.id;
    const state = payload.deployment_status?.state;

    if (!deploymentId) {
      console.warn("[updateDeploymentStatus] Missing deploymentId", {
        repoFullName,
        teamId,
      });
      return;
    }

    const validStates = ["error", "failure", "pending", "in_progress", "queued", "success"] as const;
    const normalizedState = validStates.includes(state as any) ? (state as typeof validStates[number]) : undefined;

    const updatedAt = normalizeTimestamp(payload.deployment_status?.updated_at);

    const existing = await ctx.db
      .query("githubDeployments")
      .withIndex("by_deploymentId")
      .filter((q) => q.eq(q.field("deploymentId"), deploymentId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        state: normalizedState,
        statusDescription: payload.deployment_status?.description ?? undefined,
        targetUrl: payload.deployment_status?.target_url ?? undefined,
        environmentUrl: payload.deployment_status?.environment_url ?? undefined,
        updatedAt,
      });
      console.log("[updateDeploymentStatus] Updated deployment status", {
        _id: existing._id,
        deploymentId,
        state: normalizedState,
        repoFullName,
      });
    } else {
      const sha = payload.deployment?.sha;
      if (!sha) {
        console.warn("[updateDeploymentStatus] Deployment not found and no SHA available", {
          deploymentId,
          repoFullName,
          teamId,
        });
        return;
      }

      const createdAt = normalizeTimestamp(payload.deployment?.created_at);

      const deploymentDoc = {
        provider: "github" as const,
        installationId,
        repositoryId: payload.repository?.id,
        repoFullName,
        deploymentId,
        teamId,
        sha,
        ref: payload.deployment?.ref ?? undefined,
        task: payload.deployment?.task ?? undefined,
        environment: payload.deployment?.environment ?? undefined,
        description: payload.deployment?.description ?? undefined,
        creatorLogin: payload.deployment?.creator?.login,
        createdAt,
        updatedAt,
        state: normalizedState,
        statusDescription: payload.deployment_status?.description ?? undefined,
        targetUrl: payload.deployment_status?.target_url ?? undefined,
        environmentUrl: payload.deployment_status?.environment_url ?? undefined,
        triggeringPrNumber: undefined,
      };

      const newId = await ctx.db.insert("githubDeployments", deploymentDoc);
      console.log("[updateDeploymentStatus] Created deployment with status", {
        _id: newId,
        deploymentId,
        state: normalizedState,
        repoFullName,
      });
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

    console.log("[getDeploymentsForPr] Query started", {
      teamSlugOrId,
      teamId,
      repoFullName,
      headSha,
      limit,
    });

    const allDeploymentsForRepo = await ctx.db
      .query("githubDeployments")
      .withIndex("by_team_repo", (q) =>
        q.eq("teamId", teamId).eq("repoFullName", repoFullName),
      )
      .collect();

    const deployments = allDeploymentsForRepo
      .filter((deployment) => {
        const matchesSha = headSha && deployment.sha === headSha;
        const matchesPr = deployment.triggeringPrNumber === args.prNumber;
        return matchesSha || matchesPr;
      })
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, limit);

    console.log("[getDeploymentsForPr] Found deployments", {
      teamId,
      repoFullName,
      headSha,
      foundDeployments: deployments.length,
    });

    return deployments;
  },
});

export const upsertDeploymentsFromApi = authMutation({
  args: {
    teamSlugOrId: v.string(),
    repoFullName: v.string(),
    installationId: v.number(),
    repositoryId: v.optional(v.number()),
    deployments: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const { teamSlugOrId, repoFullName, installationId, repositoryId, deployments } = args;
    const teamId = await getTeamId(ctx, teamSlugOrId);

    console.log("[upsertDeploymentsFromApi] Upserting deployments", {
      teamSlugOrId,
      teamId,
      repoFullName,
      count: deployments.length,
    });

    for (const deployment of deployments) {
      const deploymentId = deployment.id;
      const sha = deployment.sha;

      if (!deploymentId || !sha) {
        console.warn("[upsertDeploymentsFromApi] Missing required fields", {
          deploymentId,
          sha,
        });
        continue;
      }

      const createdAt = normalizeTimestamp(deployment.created_at);
      const updatedAt = normalizeTimestamp(deployment.updated_at);

      const deploymentDoc = {
        provider: "github" as const,
        installationId,
        repositoryId,
        repoFullName,
        deploymentId,
        teamId,
        sha,
        ref: deployment.ref ?? undefined,
        task: deployment.task ?? undefined,
        environment: deployment.environment ?? undefined,
        description: deployment.description ?? undefined,
        creatorLogin: deployment.creator?.login,
        createdAt,
        updatedAt,
        state: undefined,
        statusDescription: undefined,
        targetUrl: undefined,
        environmentUrl: undefined,
        triggeringPrNumber: undefined,
      };

      const existing = await ctx.db
        .query("githubDeployments")
        .withIndex("by_deploymentId")
        .filter((q) => q.eq(q.field("deploymentId"), deploymentId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, deploymentDoc);
      } else {
        await ctx.db.insert("githubDeployments", deploymentDoc);
      }
    }

    return { success: true, count: deployments.length };
  },
});
