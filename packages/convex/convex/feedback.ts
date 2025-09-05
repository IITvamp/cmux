import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { components } from "./_generated/api";
import { Resend } from "@convex-dev/resend";

const resend = new Resend(components.resend, {
  // Set to false in production to send to real email addresses
  testMode: false,
});

export const submitFeedback = mutation({
  args: {
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get user's selected team
    const teamId = user.selectedTeamId;
    if (!teamId) {
      throw new Error("No team selected");
    }

    // Store feedback in database
    const feedbackId = await ctx.db.insert("feedback", {
      userId: identity.subject,
      userEmail: user.primaryEmail || identity.email || "unknown",
      teamId,
      message: args.message,
      createdAt: Date.now(),
    });

    // Schedule email sending
    await ctx.scheduler.runAfter(0, "feedback:sendEmail", {
      feedbackId,
    });

    return { success: true, feedbackId };
  },
});

export const sendEmail = internalMutation({
  args: {
    feedbackId: v.id("feedback"),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    // Get user details
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", feedback.userId))
      .first();

    const team = await ctx.db
      .query("teams")
      .withIndex("by_teamId", (q) => q.eq("teamId", feedback.teamId))
      .first();

    const userDisplayName = user?.displayName || "Unknown User";
    const teamName = team?.displayName || team?.name || "Unknown Team";

    // Send email to founders
    await resend.sendEmail(ctx, {
      from: "Cmux Feedback <feedback@manaflow.ai>",
      to: "founders@manaflow.ai",
      subject: `[Cmux Feedback] from ${userDisplayName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px;">New Feedback Received</h2>
          
          <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 8px;">
            <p style="margin: 5px 0;"><strong>From:</strong> ${userDisplayName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${feedback.userEmail}</p>
            <p style="margin: 5px 0;"><strong>Team:</strong> ${teamName}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(feedback.createdAt).toLocaleString()}</p>
          </div>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #555; margin-bottom: 10px;">Message:</h3>
            <div style="padding: 15px; background-color: white; border: 1px solid #e5e5e5; border-radius: 8px;">
              <p style="line-height: 1.6; color: #333; white-space: pre-wrap;">${feedback.message}</p>
            </div>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #888; font-size: 12px;">
            <p>This feedback was submitted via the Cmux application.</p>
          </div>
        </div>
      `,
    });

    return { success: true };
  },
});