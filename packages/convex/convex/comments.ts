import { v } from "convex/values";
import { authMutation as mutation, authQuery as query } from "../_shared/auth";
import { ensureAuth } from "../_shared/ensureAuth";

export const createComment = mutation({
  args: {
    url: v.string(),
    page: v.string(),
    pageTitle: v.string(),
    nodeId: v.string(),
    x: v.number(),
    y: v.number(),
    content: v.string(),
    userId: v.string(),
    teamId: v.string(),
    profileImageUrl: v.optional(v.string()),
    userAgent: v.string(),
    screenWidth: v.number(),
    screenHeight: v.number(),
    devicePixelRatio: v.number(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const commentId = await ctx.db.insert("comments", {
      ...args,
      resolved: false,
      archived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return commentId;
  },
});

export const listComments = query({
  args: {
    url: v.string(),
    teamId: v.string(),
    page: v.optional(v.string()),
    resolved: v.optional(v.boolean()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("url"), args.url))
      .collect();

    const filtered = comments.filter((comment) => {
      if (args.page !== undefined && comment.page !== args.page) return false;
      if (args.resolved !== undefined && comment.resolved !== args.resolved)
        return false;
      // By default, don't show archived comments unless explicitly requested
      if (!args.includeArchived && comment.archived === true) return false;
      return true;
    });

    return filtered;
  },
});

export const resolveComment = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    await ctx.db.patch(args.commentId, {
      resolved: true,
      updatedAt: Date.now(),
    });
  },
});

export const archiveComment = mutation({
  args: {
    commentId: v.id("comments"),
    archived: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    await ctx.db.patch(args.commentId, {
      archived: args.archived,
      updatedAt: Date.now(),
    });
  },
});

export const addReply = mutation({
  args: {
    commentId: v.id("comments"),
    userId: v.string(),
    teamId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const replyId = await ctx.db.insert("commentReplies", {
      commentId: args.commentId,
      userId: args.userId,
      teamId: args.teamId,
      content: args.content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return replyId;
  },
});

export const getReplies = query({
  args: {
    commentId: v.id("comments"),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const replies = await ctx.db
      .query("commentReplies")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("commentId"), args.commentId))
      .collect();
    return replies;
  },
});
