import { v } from "convex/values";
import { authMutation, authQuery } from "./auth/functions";

export const createComment = authMutation({
  args: {
    url: v.string(),
    page: v.string(),
    pageTitle: v.string(),
    nodeId: v.string(),
    x: v.number(),
    y: v.number(),
    content: v.string(),
    profileImageUrl: v.optional(v.string()),
    userAgent: v.string(),
    screenWidth: v.number(),
    screenHeight: v.number(),
    devicePixelRatio: v.number(),
  },
  handler: async (ctx, args) => {
    const commentId = await ctx.db.insert("comments", {
      ...args,
      userId: ctx.userId,
      teamId: ctx.teamId,
      resolved: false,
      archived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return commentId;
  },
});

export const listComments = authQuery({
  args: {
    url: v.string(),
    page: v.optional(v.string()),
    resolved: v.optional(v.boolean()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { teamId, userId } = ctx;
    const query = ctx.db
      .query("comments")
      .withIndex("by_team_user", (q) => q.eq("teamId", teamId).eq("userId", userId))
      .filter((q) => q.eq(q.field("url"), args.url));

    const comments = await query.collect();

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

export const resolveComment = authMutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commentId, {
      resolved: true,
      updatedAt: Date.now(),
    });
  },
});

export const archiveComment = authMutation({
  args: {
    commentId: v.id("comments"),
    archived: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commentId, {
      archived: args.archived,
      updatedAt: Date.now(),
    });
  },
});

export const addReply = authMutation({
  args: {
    commentId: v.id("comments"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { teamId, userId } = ctx;
    const replyId = await ctx.db.insert("commentReplies", {
      commentId: args.commentId,
      userId,
      teamId,
      content: args.content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return replyId;
  },
});

export const getReplies = authQuery({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const { teamId, userId } = ctx;
    const replies = await ctx.db
      .query("commentReplies")
      .withIndex("by_team_user", (q) => q.eq("teamId", teamId).eq("userId", userId))
      .filter((q) => q.eq(q.field("commentId"), args.commentId))
      .collect();
    return replies;
  },
});
