export type HeatmapErrorCode =
  | "INPUT_VALIDATION"
  | "GIT"
  | "MODEL"
  | "DIFF"
  | "CONFIG";

export class HeatmapError extends Error {
  readonly code: HeatmapErrorCode;

  constructor(message: string, code: HeatmapErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.name = "HeatmapError";
    this.code = code;
  }
}
