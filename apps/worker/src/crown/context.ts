import { log } from "../logger";
import type { WorkerRunContext } from "./types";

const taskRunContexts = new Map<string, WorkerRunContext>();

export function registerTaskRunContext(
  taskRunId: string,
  context: WorkerRunContext
) {
  taskRunContexts.set(taskRunId, context);
  log("INFO", "Registered task run context for crown workflow", {
    taskRunId,
    hasToken: Boolean(context.token),
    hasPrompt: Boolean(context.prompt),
    agentModel: context.agentModel,
    convexUrl: context.convexUrl,
    totalRegistered: taskRunContexts.size,
  });
}

export function hasTaskRunContext(taskRunId: string): boolean {
  return taskRunContexts.has(taskRunId);
}

export function getTaskRunContext(taskRunId: string): WorkerRunContext | null {
  return taskRunContexts.get(taskRunId) ?? null;
}

export function clearTaskRunContext(taskRunId: string) {
  taskRunContexts.delete(taskRunId);
  log("INFO", "Cleared task run context", {
    taskRunId,
    remainingContexts: taskRunContexts.size,
  });
}

export function listRegisteredContextIds(): string[] {
  return Array.from(taskRunContexts.keys());
}
