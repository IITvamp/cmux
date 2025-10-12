import { validateExposedPorts } from "../../shared/src/convex-safe";
import { v } from "convex/values";
import { resolveTeamIdLoose } from "../_shared/team";
import { authMutation, authQuery } from "./users/utils";

const normalizeExposedPorts = (
  ports: readonly number[] | undefined
): number[] => {
  if (!ports || ports.length === 0) {
    return [];
  }

  const result = validateExposedPorts(ports);
  if (result.reserved.length > 0) {
    throw new Error(
      `Reserved ports cannot be exposed: ${result.reserved.join(", ")}`
    );
  }
  if (result.invalid.length > 0) {
    throw new Error(
      `Invalid ports provided: ${result.invalid.join(", ")}`
    );
  }
  return result.sanitized;
};

const normalizeHiddenPorts = (
  hidden: readonly number[] | undefined,
  exposed: readonly number[]
): number[] => {
  if (!hidden || hidden.length === 0) {
    return [];
  }

  const result = validateExposedPorts(hidden);
  if (result.reserved.length > 0) {
    throw new Error(
      `Reserved ports cannot be hidden: ${result.reserved.join(", ")}`
    );
  }
  if (result.invalid.length > 0) {
    throw new Error(
      `Invalid ports provided for hiding: ${result.invalid.join(", ")}`
    );
  }

  const exposedSet = new Set(exposed);
  const sanitizedHidden = result.sanitized.filter((port) => exposedSet.has(port));

  if (sanitizedHidden.length !== result.sanitized.length) {
    const missing = result.sanitized.filter((port) => !exposedSet.has(port));
    throw new Error(
      `Hidden ports must be a subset of exposed ports. Invalid: ${missing.join(", ")}`
    );
  }

  return sanitizedHidden;
};

export const list = authQuery({
  args: { teamSlugOrId: v.string() },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    return await ctx.db
      .query("environments")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .order("desc")
      .collect();
  },
});

export const get = authQuery({
  args: {
    teamSlugOrId: v.string(),
    id: v.id("environments"),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const environment = await ctx.db.get(args.id);
    
    if (!environment || environment.teamId !== teamId) {
      return null;
    }
    
    return environment;
  },
});

export const create = authMutation({
  args: {
    teamSlugOrId: v.string(),
    name: v.string(),
    morphSnapshotId: v.string(),
    dataVaultKey: v.string(),
    selectedRepos: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    maintenanceScript: v.optional(v.string()),
    devScript: v.optional(v.string()),
    exposedPorts: v.optional(v.array(v.number())),
    hiddenPorts: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    if (!userId) {
      throw new Error("Authentication required");
    }
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const sanitizedPorts = normalizeExposedPorts(args.exposedPorts ?? []);
    const sanitizedHiddenPorts = normalizeHiddenPorts(
      args.hiddenPorts ?? [],
      sanitizedPorts
    );
    const createdAt = Date.now();
    const normalizeScript = (script: string | undefined): string | undefined => {
      if (script === undefined) {
        return undefined;
      }
      const trimmed = script.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };
    const maintenanceScript = normalizeScript(args.maintenanceScript);
    const devScript = normalizeScript(args.devScript);

    const environmentId = await ctx.db.insert("environments", {
      name: args.name,
      teamId,
      userId,
      morphSnapshotId: args.morphSnapshotId,
      dataVaultKey: args.dataVaultKey,
      selectedRepos: args.selectedRepos,
      description: args.description,
      maintenanceScript,
      devScript,
      exposedPorts:
        sanitizedPorts.length > 0 ? sanitizedPorts : undefined,
      hiddenPorts:
        sanitizedHiddenPorts.length > 0 ? sanitizedHiddenPorts : undefined,
      createdAt,
      updatedAt: createdAt,
    });

    await ctx.db.insert("environmentSnapshotVersions", {
      environmentId,
      teamId,
      morphSnapshotId: args.morphSnapshotId,
      version: 1,
      createdAt,
      createdByUserId: userId,
      maintenanceScript,
      devScript,
    });

    return environmentId;
  },
});

export const update = authMutation({
  args: {
    teamSlugOrId: v.string(),
    id: v.id("environments"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    maintenanceScript: v.optional(v.string()),
    devScript: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const environment = await ctx.db.get(args.id);
    
    if (!environment || environment.teamId !== teamId) {
      throw new Error("Environment not found");
    }
    
    const updates: {
      name?: string;
      description?: string;
      maintenanceScript?: string;
      devScript?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    
    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (args.maintenanceScript !== undefined) {
      const trimmedMaintenance = args.maintenanceScript.trim();
      updates.maintenanceScript =
        trimmedMaintenance.length > 0 ? trimmedMaintenance : undefined;
    }

    if (args.devScript !== undefined) {
      const trimmedDevScript = args.devScript.trim();
      updates.devScript = trimmedDevScript.length > 0 ? trimmedDevScript : undefined;
    }

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

export const updateExposedPorts = authMutation({
  args: {
    teamSlugOrId: v.string(),
    id: v.id("environments"),
    ports: v.array(v.number()),
    hiddenPorts: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const environment = await ctx.db.get(args.id);

    if (!environment || environment.teamId !== teamId) {
      throw new Error("Environment not found");
    }

    const sanitizedPorts = normalizeExposedPorts(args.ports);
    const sanitizedHiddenPorts = normalizeHiddenPorts(
      args.hiddenPorts ?? [],
      sanitizedPorts
    );
    const patch: {
      exposedPorts?: number[];
      hiddenPorts?: number[];
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (sanitizedPorts.length > 0) {
      patch.exposedPorts = sanitizedPorts;
    } else {
      patch.exposedPorts = undefined;
    }

    if (sanitizedHiddenPorts.length > 0) {
      patch.hiddenPorts = sanitizedHiddenPorts;
    } else {
      patch.hiddenPorts = undefined;
    }

    await ctx.db.patch(args.id, patch);

    return {
      exposedPorts: sanitizedPorts,
      hiddenPorts: sanitizedHiddenPorts,
    };
  },
});

export const remove = authMutation({
  args: {
    teamSlugOrId: v.string(),
    id: v.id("environments"),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const environment = await ctx.db.get(args.id);
    
    if (!environment || environment.teamId !== teamId) {
      throw new Error("Environment not found");
    }
    
    await ctx.db.delete(args.id);
  },
});

export const getByDataVaultKey = authQuery({
  args: {
    dataVaultKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("environments")
      .withIndex("by_dataVaultKey", (q) => q.eq("dataVaultKey", args.dataVaultKey))
      .first();
  },
});
