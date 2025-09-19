const TASK_RUN_PREFIX = "task-run:";

export function getTaskRunPersistKey(taskRunId: string): string {
  return `${TASK_RUN_PREFIX}${taskRunId}`;
}
