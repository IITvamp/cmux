import type { LanguageModel } from "ai";
import { generateObject } from "ai";
import { z } from "zod";
import { HeatmapError } from "./errors.js";

const lineSchema = z
  .object({
    line: z.string(),
    shouldBeReviewedScore: z.number().min(0).max(1).optional(),
    shouldReviewWhy: z.string().min(4).max(160).optional(),
    mostImportantCharacterIndex: z.number().int().min(0),
  })
  .superRefine((value, ctx) => {
    const { line, shouldBeReviewedScore, shouldReviewWhy, mostImportantCharacterIndex } = value;

    if (
      typeof shouldBeReviewedScore === "number" &&
      shouldBeReviewedScore >= 0.5 &&
      (!shouldReviewWhy || shouldReviewWhy.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "shouldReviewWhy must be provided when score >= 0.5",
      });
    }

    if (
      shouldReviewWhy !== undefined &&
      (typeof shouldBeReviewedScore !== "number" || shouldBeReviewedScore < 0.5)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "shouldBeReviewedScore >= 0.5 is required when providing shouldReviewWhy",
      });
    }

    if (line.length === 0 && mostImportantCharacterIndex !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Empty lines must use index 0",
      });
    }
  });

const responseSchema = z.object({
  lines: z.array(lineSchema),
});

const SYSTEM_PROMPT = `You will receive a unified diff for a single file. Respond with one JSON object only, no markdown fences or extra text. The JSON must match this TypeScript shape exactly:\n\n{\n    "lines": Array<{\n        "line": string;\n        "shouldBeReviewedScore"?: number;\n        "shouldReviewWhy"?: string;\n        "mostImportantCharacterIndex": number;\n    }>\n}\n\nRules:\n1. Enumerate every line of the post-diff file in order (context lines and additions). Strip the diff prefix characters (+, space) when populating "line", but preserve all other characters exactly (including tabs or trailing spaces). Skip deletion-only lines (-) because they are not part of the post-image.\n2. When a line comes from a "+" entry, include "shouldBeReviewedScore" with a number between 0 and 1 (decimals allowed) describing review intensity. Omit the field for unchanged lines or when you have no useful signal.\n3. Provide "shouldReviewWhy" only when you include a score ≥ 0.5; make it a 4–10 word hint (e.g., "loops over null list"). Use plain text, no quotes or code fences.\n4. "mostImportantCharacterIndex" must be an integer 0-based index into "line" (0 ≤ index < line.length). For empty strings, use 0.\n5. Ensure the output is valid JSON: double-quoted strings, escape control characters (\n, \t, quotes) properly, and do not add comments or trailing commas.`;

export type ModelLine = z.infer<typeof lineSchema>;

interface AnalyzeDiffOptions {
  readonly diff: string;
  readonly filePath: string;
  readonly model: LanguageModel;
  readonly retries?: number;
  readonly onPrompt?: (details: { attempt: number; prompt: string }) => void;
}

export async function analyzeDiffWithModel({
  diff,
  filePath,
  model,
  retries = 2,
  onPrompt,
}: AnalyzeDiffOptions): Promise<ModelLine[]> {
  const trimmedDiff = diff.trim();
  if (trimmedDiff === "") {
    return [];
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const attemptNumber = attempt + 1;
      const prompt = `${SYSTEM_PROMPT}\n\nFile path: ${filePath}\n\n${trimmedDiff}`;
      onPrompt?.({ attempt: attemptNumber, prompt });
      const { object } = await generateObject({
        model,
        schema: responseSchema,
        prompt,
      });

      const validated = responseSchema.parse(object);

      validated.lines.forEach((line) => {
        if (
          line.line !== "" &&
          line.mostImportantCharacterIndex >= line.line.length
        ) {
          throw new HeatmapError(
            `Model returned out-of-range mostImportantCharacterIndex for ${filePath}.`,
            "MODEL"
          );
        }
      });

      return validated.lines;
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 500));
    }
  }

  throw new HeatmapError(
    `Failed to analyze diff for ${filePath}. ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    "MODEL",
    lastError instanceof Error ? { cause: lastError } : undefined
  );
}
