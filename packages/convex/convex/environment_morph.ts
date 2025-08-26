import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("environment_morph").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("environment_morph") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    provider: v.optional(v.union(v.literal("morph"), v.literal("docker"), v.literal("other"))),
    morphSnapshotId: v.optional(v.string()),
    maintenanceScript: v.optional(v.string()),
    dataKeySalt: v.optional(v.string()), // base64
    // Only encrypted secrets here; encryption happens server-side via socket handlers
    secrets: v.optional(
      v.array(
        v.object({
          key: v.string(),
          ciphertext: v.string(),
          iv: v.string(),
          authTag: v.string(),
          createdAt: v.number(),
          updatedAt: v.number(),
        })
      )
    ),
    vscode: v.optional(
      v.object({
        provider: v.union(
          v.literal("docker"),
          v.literal("morph"),
          v.literal("daytona"),
          v.literal("other")
        ),
        status: v.union(
          v.literal("starting"),
          v.literal("running"),
          v.literal("stopped")
        ),
        url: v.optional(v.string()),
        workspaceUrl: v.optional(v.string()),
        startedAt: v.optional(v.number()),
        stoppedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("environment_morph", {
      name: args.name,
      description: args.description,
      provider: args.provider ?? "morph",
      status: "creating",
      morphSnapshotId: args.morphSnapshotId,
      maintenanceScript: args.maintenanceScript,
      dataKeySalt: args.dataKeySalt,
      secrets: args.secrets ?? [],
      vscode: args.vscode,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("environment_morph"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    maintenanceScript: v.optional(v.string()),
    status: v.optional(v.union(v.literal("creating"), v.literal("ready"), v.literal("error"))),
    vscode: v.optional(
      v.object({
        provider: v.union(
          v.literal("docker"),
          v.literal("morph"),
          v.literal("daytona"),
          v.literal("other")
        ),
        status: v.union(
          v.literal("starting"),
          v.literal("running"),
          v.literal("stopped")
        ),
        url: v.optional(v.string()),
        workspaceUrl: v.optional(v.string()),
        startedAt: v.optional(v.number()),
        stoppedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

export const upsertSecrets = mutation({
  args: {
    id: v.id("environment_morph"),
    // Replaces or adds by key
    secrets: v.array(
      v.object({
        key: v.string(),
        ciphertext: v.string(),
        iv: v.string(),
        authTag: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const env = await ctx.db.get(args.id);
    if (!env) throw new Error("Environment not found");
    const existing = env.secrets ?? [];
    const map = new Map(existing.map((s) => [s.key, s] as const));
    for (const s of args.secrets) {
      map.set(s.key, s);
    }
    await ctx.db.patch(args.id, { secrets: Array.from(map.values()), updatedAt: Date.now() });
  },
});

export const removeSecret = mutation({
  args: { id: v.id("environment_morph"), key: v.string() },
  handler: async (ctx, args) => {
    const env = await ctx.db.get(args.id);
    if (!env) throw new Error("Environment not found");
    const filtered = (env.secrets ?? []).filter((s) => s.key !== args.key);
    await ctx.db.patch(args.id, { secrets: filtered, updatedAt: Date.now() });
  },
});

