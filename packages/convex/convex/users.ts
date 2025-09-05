import { authQuery } from "./users/utils";

export const getCurrentBasic = authQuery({
  // No args needed; uses auth context
  args: {},
  handler: async (ctx) => {
    const userId = ctx.identity.subject;

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const displayName = user?.displayName ?? ctx.identity.name ?? null;
    const primaryEmail =
      user?.primaryEmail ??
      ((ctx.identity as unknown as { email?: string } | null)?.email ?? null);

    // Try to surface a GitHub account id for anonymous noreply construction
    const githubAccountId = Array.isArray(user?.oauthProviders)
      ? (user!.oauthProviders!.find((p: any) =>
          String(p.id || "").toLowerCase().includes("github")
        )?.accountId ?? null)
      : null;

    return {
      userId,
      displayName,
      primaryEmail,
      githubAccountId,
    };
  },
});
