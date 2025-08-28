import type { Id } from "@cmux/convex/dataModel";
import { serverLogger } from "./utils/fileLogger.js";

export async function createPullRequestForWinner(
  taskRunId: Id<"taskRuns">,
  taskId: Id<"tasks">,
  githubToken?: string | null
): Promise<void> {
  // Crown evaluator is disabled - always return early
  serverLogger.info(
    `[CrownEvaluator] Crown evaluator functionality disabled; skipping.`
  );
  return;
}

export async function evaluateCrownWithClaudeCode(
  taskId: Id<"tasks">
): Promise<void> {
  serverLogger.info(
    `[CrownEvaluator] Crown evaluation disabled for task ${taskId}`
  );
  return;
}

