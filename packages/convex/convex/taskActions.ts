"use node";

import { v } from "convex/values";
import { api } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

// This action is deprecated in favor of the tRPC endpoint.
// Kept for backward compatibility but will be removed in the future.
export const createAndExecute = action({
  args: {
    text: v.string(),
    description: v.optional(v.string()),
    projectFullName: v.optional(v.string()),
    branch: v.optional(v.string()),
    worktreePath: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    // Create the task
    const taskId: Id<"tasks"> = await ctx.runMutation(api.tasks.create, args);

    // Note: Task execution is now handled by the tRPC endpoint
    // which spawns the Claude process directly in Node.js

    return taskId;
  },
});
