import { v } from "convex/values";
import { authMutation, authQuery } from "./users/utils";

// Generate an upload URL for the client to upload files
export const generateUploadUrl = authMutation({
  args: { teamSlugOrId: v.string() },
  handler: async (ctx) => {
    // You can add authentication/authorization here
    const url = await ctx.storage.generateUploadUrl();
    return url;
  },
});

// Get a file's URL from its storage ID
export const getUrl = authQuery({
  args: { teamSlugOrId: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error(`Failed to get URL for storage ID: ${args.storageId}`);
    }
    return url;
  },
});

// Get multiple file URLs
export const getUrls = authQuery({
  args: { teamSlugOrId: v.string(), storageIds: v.array(v.id("_storage")) },
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
