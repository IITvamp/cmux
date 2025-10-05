export type HeatmapData = Array<{
  fileName: string;
  lines: Array<{
    line: number;
    shouldBeReviewedScore?: number;
    shouldReviewWhy?: string;
    mostImportantCharacterIndex: number;
  }>;
}>;

export const debugHeatmapData: HeatmapData = [
  {
    fileName: "apps/server/src/plan/execution-plan.ts",
    lines: [
      { line: 1, shouldBeReviewedScore: 0.1, shouldReviewWhy: "Type definition looks standard", mostImportantCharacterIndex: 5 },
      { line: 2, shouldBeReviewedScore: 0.8, shouldReviewWhy: "New 'retries' field added to type", mostImportantCharacterIndex: 65 },
      { line: 3, shouldBeReviewedScore: 0.2, shouldReviewWhy: "Duration field unchanged", mostImportantCharacterIndex: 25 },
      { line: 4, shouldBeReviewedScore: 0.1, shouldReviewWhy: "Closing brace", mostImportantCharacterIndex: 2 },
      { line: 6, shouldBeReviewedScore: 0.9, shouldReviewWhy: "Array initialization with many changes", mostImportantCharacterIndex: 35 },
      { line: 18, shouldBeReviewedScore: 0.7, shouldReviewWhy: "Status changed from pending to running", mostImportantCharacterIndex: 45 },
      { line: 47, shouldBeReviewedScore: 0.6, shouldReviewWhy: "Duration and retries added", mostImportantCharacterIndex: 55 },
      { line: 73, shouldBeReviewedScore: 0.8, shouldReviewWhy: "Status changed to blocked with retries", mostImportantCharacterIndex: 40 },
      { line: 96, shouldBeReviewedScore: 0.5, shouldReviewWhy: "Status changed to queued", mostImportantCharacterIndex: 42 },
      { line: 119, shouldBeReviewedScore: 0.7, shouldReviewWhy: "Completed with retries added", mostImportantCharacterIndex: 48 },
      { line: 139, shouldBeReviewedScore: 0.6, shouldReviewWhy: "Final stage completed", mostImportantCharacterIndex: 50 },
      { line: 141, shouldBeReviewedScore: 0.9, shouldReviewWhy: "New stage added at the end", mostImportantCharacterIndex: 35 },
      { line: 145, shouldBeReviewedScore: 0.8, shouldReviewWhy: "Function signature changed to use reduce", mostImportantCharacterIndex: 25 },
      { line: 146, shouldBeReviewedScore: 0.7, shouldReviewWhy: "Reduce implementation for counting", mostImportantCharacterIndex: 30 },
      { line: 147, shouldBeReviewedScore: 0.6, shouldReviewWhy: "Reduce accumulator logic", mostImportantCharacterIndex: 35 },
      { line: 152, shouldBeReviewedScore: 0.8, shouldReviewWhy: "Function parameters changed with options", mostImportantCharacterIndex: 40 },
      { line: 153, shouldBeReviewedScore: 0.7, shouldReviewWhy: "Map function with conditional logic", mostImportantCharacterIndex: 15 },
      { line: 154, shouldBeReviewedScore: 0.6, shouldReviewWhy: "Duration and retries formatting", mostImportantCharacterIndex: 20 },
      { line: 155, shouldBeReviewedScore: 0.5, shouldReviewWhy: "Template literal for formatting", mostImportantCharacterIndex: 25 },
      { line: 160, shouldBeReviewedScore: 0.8, shouldReviewWhy: "Logic changed to check retries > 2", mostImportantCharacterIndex: 35 },
      { line: 161, shouldBeReviewedScore: 0.7, shouldReviewWhy: "Block status check", mostImportantCharacterIndex: 15 },
      { line: 162, shouldBeReviewedScore: 0.6, shouldReviewWhy: "Retries condition added", mostImportantCharacterIndex: 20 },
      { line: 166, shouldBeReviewedScore: 0.9, shouldReviewWhy: "New function added for retry summary", mostImportantCharacterIndex: 20 },
      { line: 167, shouldBeReviewedScore: 0.8, shouldReviewWhy: "Filter stages with retries", mostImportantCharacterIndex: 15 },
      { line: 168, shouldBeReviewedScore: 0.7, shouldReviewWhy: "Map to format retry information", mostImportantCharacterIndex: 20 },
    ],
  },
  {
    fileName: "packages/agents/src/selector.ts",
    lines: [
      { line: 1, shouldBeReviewedScore: 0.8, shouldReviewWhy: "Function signature changed to include priority", mostImportantCharacterIndex: 35 },
      { line: 2, shouldBeReviewedScore: 0.9, shouldReviewWhy: "Implementation completely rewritten", mostImportantCharacterIndex: 15 },
      { line: 3, shouldBeReviewedScore: 0.7, shouldReviewWhy: "Map operation to calculate scores", mostImportantCharacterIndex: 10 },
      { line: 4, shouldBeReviewedScore: 0.8, shouldReviewWhy: "Score calculation with priority weighting", mostImportantCharacterIndex: 20 },
      { line: 5, shouldBeReviewedScore: 0.6, shouldReviewWhy: "Sort by score descending", mostImportantCharacterIndex: 15 },
      { line: 8, shouldBeReviewedScore: 0.7, shouldReviewWhy: "Elapsed time calculation extracted", mostImportantCharacterIndex: 15 },
      { line: 9, shouldBeReviewedScore: 0.6, shouldReviewWhy: "Additional condition for threshold > 0", mostImportantCharacterIndex: 25 },
    ],
  },
];