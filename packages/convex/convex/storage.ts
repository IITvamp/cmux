import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate an upload URL for the client to upload files
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    // You can add authentication/authorization here
    return await ctx.storage.generateUploadUrl();
  },
});

// Get a file's URL from its storage ID
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Get multiple file URLs
export const getUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const urls = await Promise.all(
      args.storageIds.map(async (id) => {
        const url = await ctx.storage.getUrl(id);
        if (!url) {
          throw new Error(`Failed to get URL for storage ID: ${id}`);
        }
        return {
          storageId: id,
          url,
        };
      })
    );
    return urls;
  },
});
