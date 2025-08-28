import { v } from "convex/values";
import { authMutation, authQuery } from "./auth";

function fixUrl(url: string) {
  const urlObj = new URL(url);
  urlObj.port = "9777";
  return urlObj.toString();
}

// Generate an upload URL for the client to upload files
export const generateUploadUrl = authMutation({
  handler: async (ctx) => {
    // User is already authenticated via authMutation
    const url = await ctx.storage.generateUploadUrl();
    return fixUrl(url);
  },
});

// Get a file's URL from its storage ID
export const getUrl = authQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    // Note: Storage URLs don't have team/user restrictions by default
    // If you need to restrict access, you'd need to track storage IDs in a separate table
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error(`Failed to get URL for storage ID: ${args.storageId}`);
    }
    return fixUrl(url);
  },
});

// Get multiple file URLs
export const getUrls = authQuery({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    // Note: Storage URLs don't have team/user restrictions by default
    // If you need to restrict access, you'd need to track storage IDs in a separate table
    const urls = await Promise.all(
      args.storageIds.map(async (id) => {
        const url = await ctx.storage.getUrl(id);
        if (!url) {
          throw new Error(`Failed to get URL for storage ID: ${id}`);
        }
        return {
          storageId: id,
          url: fixUrl(url),
        };
      })
    );
    return urls;
  },
});
