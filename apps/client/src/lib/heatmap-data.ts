export type HeatmapData = Array<{
  fileName: string;
  lines: Array<{
    line: number;
    shouldBeReviewedScore?: number;
    shouldReviewWhy?: string;
    mostImportantCharacterIndex: number;
  }>;
}>;

// Sample heatmap data for the 2 debug files
export const sampleHeatmapData: HeatmapData = [
  {
    fileName: "apps/server/src/plan/execution-plan.ts",
    lines: [
      { line: 1, shouldBeReviewedScore: 0.1, shouldReviewWhy: "Type definition is standard", mostImportantCharacterIndex: 5 },
      { line: 2, shouldBeReviewedScore: 0.2, shouldReviewWhy: "Basic type properties", mostImportantCharacterIndex: 2 },
      { line: 3, shouldBeReviewedScore: 0.8, shouldReviewWhy: "Status enum includes new 'blocked' state", mostImportantCharacterIndex: 10 },
      { line: 4, shouldBeReviewedScore: 0.9, shouldReviewWhy: "New retries property added", mostImportantCharacterIndex: 2 },
      { line: 5, shouldBeReviewedScore: 0.1, shouldReviewWhy: "Closing brace", mostImportantCharacterIndex: 0 },
      { line: 6, shouldBeReviewedScore: 0.1, shouldReviewWhy: "Empty line", mostImportantCharacterIndex: 0 },
      { line: 7, shouldBeReviewedScore: 0.3, shouldReviewWhy: "Array declaration", mostImportantCharacterIndex: 21 },
      { line: 8, shouldBeReviewedScore: 0.7, shouldReviewWhy: "Stage with updated status", mostImportantCharacterIndex: 15 },
      { line: 9, shouldBeReviewedScore: 0.6, shouldReviewWhy: "Stage with retries", mostImportantCharacterIndex: 25 },
      { line: 10, shouldBeReviewedScore: 0.4, shouldReviewWhy: "Regular stage entry", mostImportantCharacterIndex: 10 },
      { line: 11, shouldBeReviewedScore: 0.1, shouldReviewWhy: "Array closing", mostImportantCharacterIndex: 0 },
      { line: 12, shouldBeReviewedScore: 0.1, shouldReviewWhy: "Empty line", mostImportantCharacterIndex: 0 },
      { line: 13, shouldBeReviewedScore: 0.5, shouldReviewWhy: "Function signature changed", mostImportantCharacterIndex: 21 },
      { line: 14, shouldBeReviewedScore: 0.6, shouldReviewWhy: "Using reduce instead of filter+length", mostImportantCharacterIndex: 10 },
      { line: 15, shouldBeReviewedScore: 0.7, shouldReviewWhy: "New options parameter", mostImportantCharacterIndex: 30 },
      { line: 16, shouldBeReviewedScore: 0.8, shouldReviewWhy: "Complex logic for formatting", mostImportantCharacterIndex: 15 },
      { line: 17, shouldBeReviewedScore: 0.9, shouldReviewWhy: "Enhanced blocking logic with retries", mostImportantCharacterIndex: 20 },
      { line: 18, shouldBeReviewedScore: 0.7, shouldReviewWhy: "New utility function", mostImportantCharacterIndex: 21 },
    ],
  },
  {
    fileName: "packages/agents/src/selector.ts",
    lines: [
      { line: 1, shouldBeReviewedScore: 0.6, shouldReviewWhy: "Function signature changed with new parameter", mostImportantCharacterIndex: 25 },
      { line: 2, shouldBeReviewedScore: 0.7, shouldReviewWhy: "Using map to add score calculation", mostImportantCharacterIndex: 10 },
      { line: 3, shouldBeReviewedScore: 0.8, shouldReviewWhy: "Priority-based scoring logic", mostImportantCharacterIndex: 15 },
      { line: 4, shouldBeReviewedScore: 0.9, shouldReviewWhy: "Sorting by score instead of latency", mostImportantCharacterIndex: 20 },
      { line: 5, shouldBeReviewedScore: 0.1, shouldReviewWhy: "Empty line", mostImportantCharacterIndex: 0 },
      { line: 6, shouldBeReviewedScore: 0.5, shouldReviewWhy: "Enhanced validation logic", mostImportantCharacterIndex: 15 },
      { line: 7, shouldBeReviewedScore: 0.6, shouldReviewWhy: "Added threshold validation", mostImportantCharacterIndex: 25 },
    ],
  },
];