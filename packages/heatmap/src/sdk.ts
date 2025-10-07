import { createOpenAI } from "@ai-sdk/openai";
import path from "node:path";
import { z } from "zod";
import { HeatmapError } from "./errors.js";
import { analyzeDiffWithModel, type ModelLine } from "./llm.js";
import { parseUnifiedDiff, type DiffLine } from "./diff.js";
import {
  cloneRepository,
  detectDefaultRemoteBranch,
  ensureGitDirectory,
  getFileDiff,
  listChangedFiles,
  resolveCommit,
  runGit,
} from "./git.js";

const optionsSchema = z
  .object({
    repo: z.string().min(1).optional(),
    directory: z.string().min(1).optional(),
    targetRef: z.string().min(1).optional(),
    baseRef: z.string().min(1).optional(),
    concurrency: z.number().int().min(1).max(8).optional(),
    maxFiles: z.number().int().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.repo && value.directory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Specify either a remote repo or a local directory, not both.",
        path: ["repo"],
      });
    }

    if (!value.repo && !value.directory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either a remote repo or a local git directory.",
        path: ["repo"],
      });
    }

    if (value.repo && !value.targetRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "targetRef is required when using a remote repo.",
        path: ["targetRef"],
      });
    }
  });

type SchemaOptions = z.input<typeof optionsSchema>;

export type HeatmapProgressEvent =
  | { type: "info"; message: string }
  | { type: "analyzing-file"; filePath: string }
  | { type: "skip-file"; filePath: string; reason: string }
  | { type: "model-call"; filePath: string; attempt: number; prompt: string }
  | { type: "model-success"; filePath: string; attempt: number; lineCount: number }
  | { type: "warning"; message: string; filePath?: string };

export interface GenerateHeatmapOptions extends SchemaOptions {
  readonly onProgress?: (event: HeatmapProgressEvent) => void;
}

export interface HeatmapEntry {
  readonly filePath: string;
  readonly lineNumber: number;
  readonly line: string;
  readonly score: number;
  readonly reason?: string;
  readonly mostImportantCharacterIndex: number;
}

export interface HeatmapResult {
  readonly entries: HeatmapEntry[];
  readonly baseCommit: string;
  readonly targetCommit: string;
  readonly warnings: string[];
}

function emitProgress(
  handler: ((event: HeatmapProgressEvent) => void) | undefined,
  event: HeatmapProgressEvent
) {
  if (!handler) {
    return;
  }

  try {
    handler(event);
  } catch {
    // ignore handler errors so they do not interrupt primary flow
  }
}

const LOCKFILE_SUFFIXES = [
  "/package-lock.json",
  "/pnpm-lock.yaml",
  "/yarn.lock",
  "/bun.lock",
  "/bun.lockb",
  "/Cargo.lock",
  "/Gemfile.lock",
  "/composer.lock",
  "/poetry.lock",
  "/Pipfile.lock",
  "/Podfile.lock",
];

function isLockfile(filePath: string): boolean {
  if (LOCKFILE_SUFFIXES.some((suffix) => filePath.endsWith(suffix))) {
    return true;
  }

  // Handle lockfiles that might live at repo root without leading slash in path string
  return LOCKFILE_SUFFIXES.some(
    (suffix) => filePath === suffix.slice(1)
  );
}

interface NormalizedOptions {
  readonly mode: "remote" | "local";
  readonly repo?: string;
  readonly directory: string;
  readonly targetRef: string;
  readonly baseRef?: string;
  readonly concurrency: number;
  readonly maxFiles?: number;
}

function normalizeBranchName(ref: string): string {
  if (ref.startsWith("refs/heads/")) {
    return ref.slice("refs/heads/".length);
  }

  if (ref.startsWith("refs/remotes/origin/")) {
    return ref.slice("refs/remotes/origin/".length);
  }

  if (ref.startsWith("origin/")) {
    return ref.slice("origin/".length);
  }

  return ref;
}

async function normalizeOptions(options: SchemaOptions): Promise<NormalizedOptions> {
  const parsed = optionsSchema.parse(options);

  const concurrency = parsed.concurrency ?? 2;
  const directory = path.resolve(parsed.directory ?? process.cwd());

  if (parsed.repo) {
    return {
      mode: "remote",
      repo: parsed.repo,
      directory,
      targetRef: parsed.targetRef!,
      baseRef: parsed.baseRef,
      concurrency,
      maxFiles: parsed.maxFiles,
    } satisfies NormalizedOptions;
  }

  const branch = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: directory,
  });

  const targetRef = branch === "HEAD"
    ? await runGit(["rev-parse", "HEAD"], { cwd: directory })
    : branch;

  return {
    mode: "local",
    directory,
    targetRef,
    baseRef: parsed.baseRef,
    concurrency,
    maxFiles: parsed.maxFiles,
  } satisfies NormalizedOptions;
}

interface DiffAnalysis {
  readonly filePath: string;
  readonly diffLines: DiffLine[];
  readonly modelLines: ModelLine[];
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        break;
      }

      results[currentIndex] = await handler(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

async function determineBaseRef(
  repoPath: string,
  providedBaseRef: string | undefined
): Promise<string> {
  if (providedBaseRef) {
    return providedBaseRef;
  }

  const defaultBranch = await detectDefaultRemoteBranch(repoPath);
  const remoteCandidate = `origin/${defaultBranch}`;

  try {
    await runGit(["rev-parse", remoteCandidate], { cwd: repoPath });
    return remoteCandidate;
  } catch {
    return defaultBranch;
  }
}

interface PreparedRepository {
  readonly repoPath: string;
  readonly cleanup?: () => Promise<void>;
}

async function prepareRepository(
  options: NormalizedOptions,
  onProgress?: (event: HeatmapProgressEvent) => void
): Promise<PreparedRepository> {
  if (options.mode === "remote" && options.repo) {
    emitProgress(onProgress, {
      type: "info",
      message: `Cloning repository ${options.repo}`,
    });
    const cloned = await cloneRepository(options.repo);
    emitProgress(onProgress, {
      type: "info",
      message: `Repository cloned to ${cloned.path}`,
    });
    return { repoPath: cloned.path, cleanup: cloned.cleanup } satisfies PreparedRepository;
  }

  emitProgress(onProgress, {
    type: "info",
    message: `Using local repository at ${options.directory}`,
  });
  await ensureGitDirectory(options.directory);
  return { repoPath: options.directory } satisfies PreparedRepository;
}

function findModelLineForDiffLine(
  diffLine: DiffLine,
  diffIndex: number,
  modelLines: readonly ModelLine[],
  usedModelIndexes: Set<number>
): ModelLine | undefined {
  const candidate = modelLines[diffIndex];
  if (
    candidate &&
    !usedModelIndexes.has(diffIndex) &&
    candidate.line === diffLine.content
  ) {
    usedModelIndexes.add(diffIndex);
    return candidate;
  }

  for (let index = 0; index < modelLines.length; index += 1) {
    if (usedModelIndexes.has(index)) {
      continue;
    }
    const fallback = modelLines[index];
    if (fallback.line === diffLine.content) {
      usedModelIndexes.add(index);
      return fallback;
    }
  }

  return undefined;
}

export async function generateHeatmap(
  options: GenerateHeatmapOptions
): Promise<HeatmapResult> {
  const { onProgress, ...rawOptions } = options;
  const normalized = await normalizeOptions(rawOptions);
  emitProgress(onProgress, {
    type: "info",
    message: `Prepared analysis with concurrency=${normalized.concurrency}`,
  });

  const { repoPath, cleanup } = await prepareRepository(normalized, onProgress);
  const warnings: string[] = [];

  try {
    const baseRef = await determineBaseRef(repoPath, normalized.baseRef);
    emitProgress(onProgress, {
      type: "info",
      message: `Resolved base reference to ${baseRef}`,
    });

    const targetResolved = await resolveCommit(repoPath, normalized.targetRef);
    const baseResolved = await resolveCommit(repoPath, baseRef);

    emitProgress(onProgress, {
      type: "info",
      message: `Comparing ${baseResolved.canonicalRef}@${baseResolved.commit.slice(0, 7)} → ${targetResolved.canonicalRef}@${targetResolved.commit.slice(0, 7)}`,
    });

    if (
      normalizeBranchName(baseResolved.canonicalRef) ===
      normalizeBranchName(targetResolved.canonicalRef)
    ) {
      throw new HeatmapError(
        `Base ref (${baseResolved.canonicalRef}) and target ref (${targetResolved.canonicalRef}) resolve to the same branch. Provide different refs.`,
        "INPUT_VALIDATION"
      );
    }

    if (baseResolved.commit === targetResolved.commit) {
      throw new HeatmapError(
        "Base and target refs point to the same commit, so there is nothing to compare.",
        "DIFF"
      );
    }

    const changedFiles = (await listChangedFiles(
      repoPath,
      baseResolved.commit,
      targetResolved.commit
    )).filter((filePath) => {
      if (isLockfile(filePath)) {
        emitProgress(onProgress, {
          type: "skip-file",
          filePath,
          reason: "Skipping lockfile",
        });
        return false;
      }
      return true;
    });

    if (changedFiles.length === 0) {
      throw new HeatmapError(
        "No changes detected between the base and target refs.",
        "DIFF"
      );
    }

    emitProgress(onProgress, {
      type: "info",
      message: `Found ${changedFiles.length} changed files`,
    });

    const filesToAnalyze = normalized.maxFiles
      ? changedFiles.slice(0, normalized.maxFiles)
      : changedFiles;

    if (normalized.maxFiles && changedFiles.length > normalized.maxFiles) {
      emitProgress(onProgress, {
        type: "info",
        message: `Limiting analysis to first ${normalized.maxFiles} files out of ${changedFiles.length}`,
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new HeatmapError(
        "OPENAI_API_KEY environment variable is required to run heatmap analysis.",
        "CONFIG"
      );
    }

    const openai = createOpenAI({ apiKey });
    const model = openai("gpt-5");

    const analyses = await runWithConcurrency(
      filesToAnalyze,
      normalized.concurrency,
      async (filePath) => {
        emitProgress(onProgress, {
          type: "analyzing-file",
          filePath,
        });
        const diff = await getFileDiff(
          repoPath,
          baseResolved.commit,
          targetResolved.commit,
          filePath
        );

        if (!diff) {
          emitProgress(onProgress, {
            type: "skip-file",
            filePath,
            reason: "No diff output or binary change",
          });
          return null;
        }

        const diffLines = parseUnifiedDiff(diff);
        if (diffLines.length === 0) {
          emitProgress(onProgress, {
            type: "skip-file",
            filePath,
            reason: "Diff contains no post-image lines",
          });
          return null;
        }

        let modelLines: ModelLine[];
        let lastAttempt = 0;
        try {
          modelLines = await analyzeDiffWithModel({
            diff,
            filePath,
            model,
            onPrompt: ({ attempt, prompt }) => {
              lastAttempt = attempt;
              emitProgress(onProgress, {
                type: "model-call",
                filePath,
                attempt,
                prompt,
              });
            },
          });
        } catch (error) {
          if (error instanceof HeatmapError && error.code === "MODEL") {
            const message = `Model analysis failed for ${filePath}: ${error.message}`;
            warnings.push(message);
            emitProgress(onProgress, {
              type: "warning",
              message,
              filePath,
            });
            return null;
          }
          throw error;
        }

        emitProgress(onProgress, {
          type: "model-success",
          filePath,
          attempt: lastAttempt || 1,
          lineCount: modelLines.length,
        });

        return {
          filePath,
          diffLines,
          modelLines,
        } satisfies DiffAnalysis;
      }
    );

    const validAnalyses = analyses.filter(
      (analysis): analysis is DiffAnalysis => analysis !== null
    );

    if (validAnalyses.length === 0) {
      if (warnings.length > 0) {
        throw new HeatmapError(
          `Model analysis failed for all files:\n${warnings.join("\n")}`,
          "MODEL"
        );
      }

      throw new HeatmapError(
        "No textual diffs were found to analyze (all files may be binary or deleted).",
        "DIFF"
      );
    }

    const entries: HeatmapEntry[] = [];

    for (const analysis of validAnalyses) {
      const usedModelIndexes = new Set<number>();
      analysis.diffLines.forEach((diffLine, index) => {
        if (diffLine.type !== "addition") {
          return;
        }

        const modelLine = findModelLineForDiffLine(
          diffLine,
          index,
          analysis.modelLines,
          usedModelIndexes
        );

        if (!modelLine) {
          return;
        }

        if (modelLine.shouldBeReviewedScore === undefined) {
          return;
        }

        entries.push({
          filePath: analysis.filePath,
          lineNumber: diffLine.lineNumber,
          line: modelLine.line,
          score: modelLine.shouldBeReviewedScore,
          reason: modelLine.shouldReviewWhy?.trim() || undefined,
          mostImportantCharacterIndex: modelLine.mostImportantCharacterIndex,
        });
      });
    }

    const sortedEntries = entries.sort((a, b) => b.score - a.score);

    return {
      entries: sortedEntries,
      baseCommit: baseResolved.commit,
      targetCommit: targetResolved.commit,
      warnings,
    } satisfies HeatmapResult;
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }
}

export function formatHeatmapEntries(entries: readonly HeatmapEntry[]): string[] {
  return entries.map((entry) => {
    const score = entry.score.toFixed(2);
    const reason = entry.reason ? ` – ${entry.reason}` : "";
    const snippet = entry.line.trim() === "" ? "" : ` | ${entry.line}`;
    return `${entry.filePath}:${entry.lineNumber} score=${score} idx=${entry.mostImportantCharacterIndex}${reason}${snippet}`;
  });
}
