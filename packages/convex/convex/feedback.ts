import { v } from "convex/values";
import { resolveTeamIdLoose } from "../_shared/team";
import { authMutation } from "./users/utils";

export const submit = authMutation({
  args: {
    teamSlugOrId: v.string(),
    message: v.string(),
    email: v.optional(v.string()),
    page: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = ctx.identity;
    const userId = identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const now = Date.now();
    await ctx.db.insert("feedback", {
      teamId,
      userId,
      message: args.message,
      email: args.email,
      page: args.page,
      userAgent: args.userAgent,
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true } as const;
  },
});

