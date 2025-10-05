export type DiffHeatmapLine = {
  line: number;
  shouldBeReviewedScore?: number;
  shouldReviewWhy?: string;
  mostImportantCharacterIndex: number;
};

export type DiffHeatmapEntry = {
  fileName: string;
  lines: DiffHeatmapLine[];
};
