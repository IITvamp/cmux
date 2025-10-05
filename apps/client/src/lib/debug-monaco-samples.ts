export type MonacoLanguage =
  | "typescript"
  | "javascript"
  | "json"
  | "markdown"
  | "yaml"
  | "plaintext";

export type DiffSample = {
  id: string;
  filePath: string;
  language: MonacoLanguage;
  original: string;
  modified: string;
};

const EXECUTION_PLAN_STAGE_COUNT = 140;

const executionPlanUpdates = new Map<
  number,
  { status: string; durationMs: number; retries: number }
>([
  [0, { status: "queued", durationMs: 45, retries: 1 }],
  [18, { status: "running", durationMs: 240, retries: 0 }],
  [47, { status: "running", durationMs: 420, retries: 2 }],
  [73, { status: "blocked", durationMs: 0, retries: 3 }],
  [96, { status: "queued", durationMs: 195, retries: 1 }],
  [119, { status: "completed", durationMs: 940, retries: 1 }],
  [139, { status: "completed", durationMs: 1230, retries: 2 }],
]);

const executionPlanInsertions = new Map<number, string[]>([
  [
    59,
    [
      '  { id: "stage-060-review", status: "blocked", durationMs: 0, retries: 2 },',
      '  { id: "stage-060-retry", status: "queued", durationMs: 42, retries: 3 },',
    ],
  ],
  [
    104,
    [
      '  { id: "stage-105-diagnostics", status: "running", durationMs: 720, retries: 1 },',
    ],
  ],
]);

function createLongExecutionPlanSample(): DiffSample {
  const padLabel = (value: number) => value.toString().padStart(3, "0");

  const originalParts: string[] = [
    "type ExecutionStage = {",
    "  id: string;",
    '  status: "pending" | "queued" | "running" | "blocked" | "completed";',
    "  durationMs?: number;",
    "};",
    "",
    "export const executionPlan: ExecutionStage[] = [",
  ];

  const modifiedParts: string[] = [
    "type ExecutionStage = {",
    "  id: string;",
    '  status: "pending" | "queued" | "running" | "blocked" | "completed";',
    "  durationMs?: number;",
    "  retries?: number;",
    "};",
    "",
    "export const executionPlan: ExecutionStage[] = [",
  ];

  for (let index = 0; index < EXECUTION_PLAN_STAGE_COUNT; index += 1) {
    const label = padLabel(index + 1);
    const baseDuration = ((index % 9) + 1) * 25;
    const baseLine = `  { id: "stage-${label}", status: "pending", durationMs: ${baseDuration} },`;
    originalParts.push(baseLine);

    const update = executionPlanUpdates.get(index);
    if (update) {
      modifiedParts.push(
        `  { id: "stage-${label}", status: "${update.status}", durationMs: ${update.durationMs}, retries: ${update.retries} },`,
      );
    } else {
      modifiedParts.push(baseLine);
    }

    const insertions = executionPlanInsertions.get(index);
    if (insertions) {
      modifiedParts.push(...insertions);
    }
  }

  modifiedParts.push(
    '  { id: "stage-141", status: "review", durationMs: 210, retries: 1 },',
  );

  originalParts.push("];");
  modifiedParts.push("];");

  originalParts.push(
    "",
    'export function countStages(status: ExecutionStage["status"]) {',
    "  return executionPlan.filter((stage) => stage.status === status).length;",
    "}",
    "",
    "export function describePlan() {",
    '  return executionPlan.map((stage) => stage.id).join(", ");',
    "}",
    "",
    "export function hasBlockingStage() {",
    '  return executionPlan.some((stage) => stage.status === "blocked");',
    "}",
  );

  modifiedParts.push(
    "",
    'export function countStages(status: ExecutionStage["status"]) {',
    "  return executionPlan.reduce((total, stage) =>",
    "    stage.status === status ? total + 1 : total,",
    "  0);",
    "}",
    "",
    "export function describePlan(options: { includeDurations?: boolean } = {}) {",
    "  return executionPlan",
    "    .map((stage) => {",
    "      if (!options.includeDurations) {",
    "        return stage.id;",
    "      }",
    "      const duration = stage.durationMs ?? 0;",
    "      const retries = stage.retries ?? 0;",
    "      return `${stage.id} (${duration}ms, retries=${retries})`;",
    "    })",
    "    .join(",
    ");",
    "}",
    "",
    "export function hasBlockingStage() {",
    "  return executionPlan.some((stage) => {",
    '    if (stage.status === "blocked") {',
    "      return true;",
    "    }",
    "    return (stage.retries ?? 0) > 2;",
    "  });",
    "}",
    "",
    "export function getRetrySummary() {",
    "  return executionPlan",
    "    .filter((stage) => (stage.retries ?? 0) > 0)",
    "    .map((stage) => `${stage.id}:${stage.retries ?? 0}`)",
    "    .join(",
    ");",
    "}",
  );

  return {
    id: "execution-plan",
    filePath: "apps/server/src/plan/execution-plan.ts",
    language: "typescript",
    original: originalParts.join("\n"),
    modified: modifiedParts.join("\n"),
  };
}

const longExecutionPlanSample = createLongExecutionPlanSample();

const baseDebugMonacoDiffSamples: DiffSample[] = [
  longExecutionPlanSample,
  {
    id: "agents-selector",
    filePath: "packages/agents/src/selector.ts",
    language: "typescript",
    original: `export function rankAgents(agents: Array<{ latency: number }>) {
  return [...agents].sort((a, b) => a.latency - b.latency);
}

export function shouldWakeAgent(lastActiveAt: number, thresholdMs: number) {
  return Date.now() - lastActiveAt > thresholdMs;
}
`,
    modified: `export function rankAgents(agents: Array<{ latency: number; priority?: number }>) {
  return [...agents]
    .map((agent) => ({
      ...agent,
      score: (agent.priority ?? 0) * 1000 - agent.latency,
    }))
    .sort((a, b) => b.score - a.score);
}

export function shouldWakeAgent(lastActiveAt: number, thresholdMs: number) {
  const elapsed = Date.now() - lastActiveAt;
  return elapsed >= thresholdMs && thresholdMs > 0;
}
`,
  },
];

export const debugMonacoDiffSamples: DiffSample[] = baseDebugMonacoDiffSamples;
