import { log } from "./logger.js";

interface ConvexCallOptions {
  url: string;
  authToken: string;
  teamSlugOrId: string;
}

interface TaskRunCompleteData {
  taskRunId: string;
  exitCode?: number;
  taskId: string;
}

interface CrownEvaluationData {
  taskId: string;
  teamSlugOrId: string;
}

/**
 * Retry logic for network operations with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if error is due to optimistic concurrency
      if (error instanceof Error && error.message.includes("Contention")) {
        log("INFO", `Optimistic concurrency error, attempt ${attempt + 1}/${maxRetries}`, error);
      } else {
        log("ERROR", `Operation failed, attempt ${attempt + 1}/${maxRetries}`, error);
      }

      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        log("INFO", `Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Mark a task run as complete in Convex
 */
export async function markTaskRunComplete(
  options: ConvexCallOptions,
  data: TaskRunCompleteData
): Promise<{ alreadyCompleted: boolean }> {
  const { url, authToken, teamSlugOrId } = options;

  log("INFO", `[ConvexService] Marking task run ${data.taskRunId} as complete`);

  return retryWithBackoff(async () => {
    const response = await fetch(`${url}/api/mutation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        path: "taskRuns:markTaskRunComplete",
        args: {
          teamSlugOrId,
          taskRunId: data.taskRunId,
          exitCode: data.exitCode ?? 0,
        },
        format: "json",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to mark task run complete: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.status === "error") {
      throw new Error(result.errorMessage || "Unknown error marking task run complete");
    }

    log("INFO", `[ConvexService] Task run ${data.taskRunId} marked as complete`, result.value);
    return result.value;
  });
}

/**
 * Check if all task runs for a task are complete
 */
export async function checkAllTaskRunsComplete(
  options: ConvexCallOptions,
  taskId: string
): Promise<{
  allComplete: boolean;
  totalRuns: number;
  completedRuns: number;
  taskRuns: Array<{ id: string; status: string; agentName?: string }>;
}> {
  const { url, authToken, teamSlugOrId } = options;

  log("INFO", `[ConvexService] Checking if all task runs are complete for task ${taskId}`);

  return retryWithBackoff(async () => {
    const response = await fetch(`${url}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        path: "taskRuns:checkAllTaskRunsComplete",
        args: {
          teamSlugOrId,
          taskId,
        },
        format: "json",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to check task runs: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.status === "error") {
      throw new Error(result.errorMessage || "Unknown error checking task runs");
    }

    const data = result.value;
    log("INFO", `[ConvexService] Task ${taskId}: ${data.completedRuns}/${data.totalRuns} complete`, {
      allComplete: data.allComplete,
      taskRuns: data.taskRuns,
    });

    return data;
  });
}

/**
 * Trigger crown evaluation for a task
 */
export async function triggerCrownEvaluation(
  options: ConvexCallOptions,
  data: CrownEvaluationData
): Promise<void> {
  const { url, authToken, teamSlugOrId } = options;

  log("INFO", `[ConvexService] Triggering crown evaluation for task ${data.taskId}`);

  // First, mark task as pending evaluation
  await retryWithBackoff(async () => {
    const response = await fetch(`${url}/api/mutation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        path: "tasks:checkAndEvaluateCrown",
        args: {
          teamSlugOrId,
          taskId: data.taskId,
        },
        format: "json",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to trigger crown evaluation: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.status === "error") {
      throw new Error(result.errorMessage || "Unknown error triggering crown evaluation");
    }

    log("INFO", `[ConvexService] Crown evaluation triggered for task ${data.taskId}`, result.value);
    return result.value;
  });

  // If evaluation is pending, call the crown HTTP endpoint directly
  const completionStatus = await checkAllTaskRunsComplete(options, data.taskId);

  if (completionStatus.allComplete && completionStatus.totalRuns >= 2) {
    log("INFO", `[ConvexService] All runs complete, calling crown HTTP endpoint`);

    await retryWithBackoff(async () => {
      // Call the crown HTTP endpoint for evaluation
      const crownUrl = `${url.replace("/api", "")}/crown/evaluate`;

      const response = await fetch(crownUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-stack-auth": JSON.stringify({ accessToken: authToken }),
        },
        body: JSON.stringify({
          teamSlugOrId,
          prompt: `Evaluate implementations for task ${data.taskId}`, // This will be built by the crown action
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log("WARNING", `Crown evaluation HTTP call failed: ${response.status} - ${errorText}`);
        // Don't throw here - evaluation might already be in progress
      } else {
        const result = await response.json();
        log("INFO", `[ConvexService] Crown evaluation HTTP response:`, result);
      }
    });
  }
}