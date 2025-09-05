import { v } from "convex/values";
import { authMutation } from "./users/utils";
import { getTeamId } from "../_shared/team";
import { resendClient } from "./resend";

export const submit = authMutation({
  args: {
    teamSlugOrId: v.string(),
    message: v.string(),
    pageUrl: v.optional(v.string()),
  },
  handler: async (ctx, { teamSlugOrId, message, pageUrl }) => {
    const teamId = await getTeamId(ctx, teamSlugOrId);
    const userId = ctx.identity.subject;

    // Derive email/display name server-side from identity and stored user row
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const primaryEmail =
      user?.primaryEmail ??
      ((ctx.identity as unknown as { email?: string } | null)?.email ?? null);
    const displayName = user?.displayName ?? ctx.identity.name ?? null;

    const now = Date.now();
    await ctx.db.insert("feedbacks", {
      message,
      userId,
      teamId,
      userEmail: primaryEmail ?? undefined,
      userDisplayName: displayName ?? undefined,
      pageUrl,
      createdAt: now,
    });

    // Fire-and-forget email via Resend component
    await resendClient.sendEmail(ctx, {
      from: "CMUX Feedback <feedback@manaflow.ai>",
      to: "founders@manaflow.ai",
      subject: "New CMUX feedback",
      html: [
        `<p><strong>Team:</strong> ${teamId}</p>`,
        `<p><strong>User:</strong> ${displayName ?? userId}</p>`,
        primaryEmail ? `<p><strong>Email:</strong> ${primaryEmail}</p>` : "",
        pageUrl ? `<p><strong>Page:</strong> ${pageUrl}</p>` : "",
        `<pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",\"Courier New\",monospace">${
          escapeHtml(message)
        }</pre>`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return { ok: true } as const;
  },
});

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

