export type WorkerRunStatus = "pending" | "running" | "completed" | "failed";

export type WorkerRunContext = {
  token: string;
  prompt: string;
  agentModel?: string;
  teamId?: string;
  taskId?: string;
  convexUrl?: string;
};

export type CrownWorkerCheckResponse = {
  ok: true;
  taskId: string;
  allRunsFinished: boolean;
  allWorkersReported: boolean;
  shouldEvaluate: boolean;
  singleRunWinnerId: string | null;
  existingEvaluation: null | {
    winnerRunId: string;
    evaluatedAt: number;
  };
  task: {
    text: string;
    crownEvaluationError: string | null;
    isCompleted: boolean;
    baseBranch: string | null;
    projectFullName: string | null;
    autoPrEnabled: boolean;
  };
  runs: Array<{
    id: string;
    status: WorkerRunStatus;
    agentName: string | null;
    newBranch: string | null;
    exitCode: number | null;
    completedAt: number | null;
  }>;
};

export type WorkerTaskRunDescriptor = {
  id: string;
  taskId: string;
  teamId: string;
  newBranch: string | null;
  agentName: string | null;
};

export type WorkerTaskRunResponse = {
  ok: boolean;
  taskRun: WorkerTaskRunDescriptor | null;
  task: { id: string; text: string; projectFullName?: string | null } | null;
  containerSettings: {
    autoCleanupEnabled: boolean;
    stopImmediatelyOnCompletion: boolean;
    reviewPeriodMinutes: number;
  } | null;
};

export type WorkerAllRunsCompleteResponse = {
  ok: boolean;
  taskId: string;
  allComplete: boolean;
  statuses: Array<{ id: string; status: string }>;
};

export type CandidateData = {
  runId: string;
  agentName: string;
  gitDiff: string;
  newBranch: string | null;
};

export type CrownEvaluationResponse = {
  winner: number;
  reason: string;
};

export type CrownSummarizationResponse = {
  summary: string;
};

export type PullRequestMetadata = {
  pullRequest?: {
    url: string;
    isDraft?: boolean;
    state?: "none" | "draft" | "open" | "merged" | "closed" | "unknown";
    number?: number;
  };
  title?: string;
  description?: string;
};