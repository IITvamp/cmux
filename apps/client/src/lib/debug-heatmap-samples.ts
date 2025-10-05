export type DebugHeatmapLineHighlight = {
  line: number;
  shouldBeReviewedScore?: number;
  shouldReviewWhy?: string;
  mostImportantCharacterIndex: number;
};

export type DebugHeatmapFileHighlights = {
  fileName: string;
  lines: DebugHeatmapLineHighlight[];
};

export const debugHeatmapHighlights: DebugHeatmapFileHighlights[] = [
  {
    fileName: "apps/server/src/plan/execution-plan.ts",
    lines: [
      {
        line: 6,
        shouldBeReviewedScore: 0.35,
        shouldReviewWhy: "New optional retries field could break serialization logic.",
        mostImportantCharacterIndex: 2,
      },
      {
        line: 24,
        shouldBeReviewedScore: 0.55,
        shouldReviewWhy: "Changed status for long-running stages; needs verification.",
        mostImportantCharacterIndex: 10,
      },
      {
        line: 68,
        shouldBeReviewedScore: 0.9,
        shouldReviewWhy: "Blocked stage fallback is now more permissive.",
        mostImportantCharacterIndex: 6,
      },
      {
        line: 128,
        shouldBeReviewedScore: 0.75,
        shouldReviewWhy: "Retry summary now maps with side effects; confirm perf impact.",
        mostImportantCharacterIndex: 4,
      },
    ],
  },
  {
    fileName: "packages/agents/src/selector.ts",
    lines: [
      {
        line: 3,
        shouldBeReviewedScore: 0.2,
        shouldReviewWhy: "Sorting switched to score calculation; double-check ordering.",
        mostImportantCharacterIndex: 12,
      },
      {
        line: 7,
        shouldBeReviewedScore: 0.65,
        shouldReviewWhy: "Score uses priority multiplier which may overflow for large values.",
        mostImportantCharacterIndex: 16,
      },
      {
        line: 12,
        shouldBeReviewedScore: 0.8,
        shouldReviewWhy: "Wake logic now clamps threshold; ensure zero threshold works.",
        mostImportantCharacterIndex: 2,
      },
    ],
  },
];
