import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    profileImageUrl: v.optional(v.string()),
    userAgent: v.string(),
    screenWidth: v.number(),
    screenHeight: v.number(),
    devicePixelRatio: v.number(),
  },
  handler: async (ctx, args) => {
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
    page: v.optional(v.string()),
    resolved: v.optional(v.boolean()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("comments")
      .withIndex("by_url", (q) => q.eq("url", args.url));

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

export const resolveComment = mutation({
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

export const archiveComment = mutation({
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

export const addReply = mutation({
  args: {
    commentId: v.id("comments"),
    userId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const replyId = await ctx.db.insert("commentReplies", {
      commentId: args.commentId,
      userId: args.userId,
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
  },
  handler: async (ctx, args) => {
    const replies = await ctx.db
      .query("commentReplies")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .collect();
    return replies;
  },
});
