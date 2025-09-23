import { ConvexHttpClient } from "convex/browser";
import { api } from "@cmux/convex/api";
import { log } from "./logger.js";
import type { Id } from "@cmux/convex/dataModel";

// Get Convex URL from environment or use defaults
const CONVEX_URL =
  process.env.CONVEX_URL ||
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  "https://happy-mouse-461.convex.cloud";

log("INFO", `Using Convex URL: ${CONVEX_URL}`);

// Create Convex client
const convexClient = new ConvexHttpClient(CONVEX_URL);

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function withRetry<T>(
  fn: () => Promise<T>,
  description: string
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      log(
        "WARNING",
        `Attempt ${attempt}/${MAX_RETRIES} failed for ${description}`,
        lastError
      );
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }
  throw lastError || new Error(`Failed after ${MAX_RETRIES} attempts: ${description}`);
}

/**
 * Mark a taskRun as complete in Convex
 */
export async function markTaskRunComplete(
  taskRunId: string,
  exitCode?: number
): Promise<{ success: boolean; allComplete: boolean }> {
  return withRetry(
    async () => {
      log("INFO", `Marking taskRun ${taskRunId} as complete`, { exitCode });
      const result = await convexClient.mutation(api.taskRuns.workerMarkComplete, {
        taskRunId: taskRunId as Id<"taskRuns">,
        exitCode,
      });
      log("INFO", `TaskRun ${taskRunId} marked as complete`, result);
      return result;
    },
    `markTaskRunComplete(${taskRunId})`
  );
}

/**
 * Mark a taskRun as failed in Convex
 */
export async function markTaskRunFailed(
  taskRunId: string,
  errorMessage: string,
  exitCode?: number
): Promise<{ success: boolean; allDone: boolean }> {
  return withRetry(
    async () => {
      log("INFO", `Marking taskRun ${taskRunId} as failed`, { errorMessage, exitCode });
      const result = await convexClient.mutation(api.taskRuns.workerMarkFailed, {
        taskRunId: taskRunId as Id<"taskRuns">,
        errorMessage,
        exitCode,
      });
      log("INFO", `TaskRun ${taskRunId} marked as failed`, result);
      return result;
    },
    `markTaskRunFailed(${taskRunId})`
  );
}

/**
 * Check if all taskRuns for a task are complete
 */
export async function checkAllTaskRunsComplete(
  taskId: string
): Promise<{
  allComplete: boolean;
  hasRuns: boolean;
  hasSuccessful?: boolean;
  totalRuns?: number;
  completedCount?: number;
  failedCount?: number;
}> {
  return withRetry(
    async () => {
      const result = await convexClient.query(api.taskRuns.checkAllTaskRunsComplete, {
        taskId: taskId as Id<"tasks">,
      });
      return result;
    },
    `checkAllTaskRunsComplete(${taskId})`
  );
}