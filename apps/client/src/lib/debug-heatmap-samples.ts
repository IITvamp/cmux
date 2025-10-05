import type { DiffHeatmapEntry } from "@/components/diff-heatmap-types";
import { debugMonacoDiffSamples } from "./debug-monaco-samples";

export const debugHeatmapDiffSamples = debugMonacoDiffSamples;

export const debugHeatmapHighlights: DiffHeatmapEntry[] = [
  {
    fileName: "apps/server/src/plan/execution-plan.ts",
    lines: [
      {
        line: 5,
        shouldBeReviewedScore: 0.42,
        shouldReviewWhy: "New optional retries field changes execution semantics.",
        mostImportantCharacterIndex: 2,
      },
      {
        line: 42,
        shouldBeReviewedScore: 0.76,
        shouldReviewWhy: "Retry-aware scheduling logic may impact queue fairness.",
        mostImportantCharacterIndex: 6,
      },
      {
        line: 198,
        shouldBeReviewedScore: 0.9,
        shouldReviewWhy: "New retry summary helper alters telemetry aggregation.",
        mostImportantCharacterIndex: 4,
      },
    ],
  },
  {
    fileName: "packages/agents/src/selector.ts",
    lines: [
      {
        line: 5,
        shouldBeReviewedScore: 0.68,
        shouldReviewWhy: "Priority-based scoring could starve low-priority agents.",
        mostImportantCharacterIndex: 6,
      },
      {
        line: 11,
        shouldBeReviewedScore: 0.31,
        shouldReviewWhy: "Wake logic now checks thresholds defensively.",
        mostImportantCharacterIndex: 9,
      },
    ],
  },
];
