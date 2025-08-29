import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const recordWebhookDelivery = internalMutation({
  args: {
    provider: v.string(),
    deliveryId: v.string(),
    installationId: v.optional(v.number()),
    payloadHash: v.string(),
  },
  handler: async (ctx, { provider, deliveryId, installationId, payloadHash }) => {
    const existing = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_deliveryId", (q) => q.eq("deliveryId", deliveryId))
      .first();
    if (existing) return { created: false } as const;
    await ctx.db.insert("webhookDeliveries", {
      provider,
      deliveryId,
      installationId,
      payloadHash,
      receivedAt: Date.now(),
    });
    return { created: true } as const;
  },
});

export const upsertProviderConnectionFromInstallation = internalMutation({
  args: {
    installationId: v.number(),
    accountLogin: v.string(),
    accountId: v.number(),
    accountType: v.union(v.literal("User"), v.literal("Organization")),
    // Optional: if the installation was initiated from a specific team context
    teamId: v.optional(v.string()),
    connectedByUserId: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { installationId, accountLogin, accountId, accountType, teamId, connectedByUserId, isActive }
  ) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("providerConnections")
      .withIndex("by_installationId", (q) => q.eq("installationId", installationId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        accountLogin,
        accountId,
        accountType,
        teamId: teamId ?? existing.teamId,
        connectedByUserId: connectedByUserId ?? existing.connectedByUserId,
        isActive: isActive ?? true,
        updatedAt: now,
      });
      return existing._id;
    }
    const id = await ctx.db.insert("providerConnections", {
      installationId,
      accountLogin,
      accountId,
      accountType,
      teamId, // may be undefined until mapped
      connectedByUserId,
      type: "github_app",
      isActive: isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const deactivateProviderConnection = internalMutation({
  args: { installationId: v.number() },
  handler: async (ctx, { installationId }) => {
    const existing = await ctx.db
      .query("providerConnections")
      .withIndex("by_installationId", (q) => q.eq("installationId", installationId))
      .first();
    if (!existing) return { ok: true } as const;
    await ctx.db.patch(existing._id, { isActive: false, updatedAt: Date.now() });
    return { ok: true } as const;
  },
});

