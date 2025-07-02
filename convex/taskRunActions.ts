"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

// This action is deprecated in favor of the tRPC endpoint.
// Kept for backward compatibility but will be removed in the future.
export const executeTaskRun = action({
  args: {
    taskRunId: v.id("taskRuns"),
    prompt: v.string(),
  },
  handler: async (): Promise<void> => {
    // Note: Task execution is now handled by the tRPC endpoint
    // which spawns the Claude process directly in Node.js
    console.log("executeTaskRun is deprecated. Use tRPC endpoint instead.");
  },
});