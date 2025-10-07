#!/usr/bin/env bun
import { Command } from "commander";
import { formatHeatmapEntries, generateHeatmap } from "./sdk.js";
import { HeatmapError } from "./errors.js";

interface ParsedNumberOption {
  readonly value?: number;
  readonly error?: string;
}

const program = new Command();

function parsePositiveInteger(input: string, label: string): ParsedNumberOption {
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return { error: `${label} must be a positive integer.` };
  }
  return { value: parsed };
}

program
  .name("cmux-heatmap")
  .description("Generate a review heatmap from git diffs using GPT-5")
  .option("--repo <url>", "Remote git repository to clone")
  .option("--ref <ref>", "Target git ref (branch or commit)")
  .option("--base <ref>", "Base git ref to compare against")
  .option("--dir <path>", "Path to local git repository (defaults to cwd)")
  .option("--concurrency <number>", "Maximum concurrent model calls (default 2)")
  .option("--max-files <number>", "Limit the number of files analyzed")
  .option("--limit <number>", "Limit the number of heatmap entries in the output")
  .option("--json", "Output results as JSON", false)
  .action(async (options) => {
    if (options.repo && !options.ref) {
      console.error("--ref is required when using --repo.");
      process.exitCode = 1;
      return;
    }

    const concurrencyOption = options.concurrency
      ? parsePositiveInteger(options.concurrency, "--concurrency")
      : { value: undefined };

    if (concurrencyOption.error) {
      console.error(concurrencyOption.error);
      process.exitCode = 1;
      return;
    }

    const maxFilesOption = options.maxFiles
      ? parsePositiveInteger(options.maxFiles, "--max-files")
      : { value: undefined };

    if (maxFilesOption.error) {
      console.error(maxFilesOption.error);
      process.exitCode = 1;
      return;
    }

    const limitOption = options.limit
      ? parsePositiveInteger(options.limit, "--limit")
      : { value: undefined };

    if (limitOption.error) {
      console.error(limitOption.error);
      process.exitCode = 1;
      return;
    }

    const directory = options.dir ?? (options.repo ? undefined : process.cwd());

    try {
      const result = await generateHeatmap({
        repo: options.repo,
        directory,
        targetRef: options.ref,
        baseRef: options.base,
        concurrency: concurrencyOption.value,
        maxFiles: maxFilesOption.value,
        onProgress: (event) => {
          switch (event.type) {
            case "info":
              console.log(`[info] ${event.message}`);
              break;
            case "analyzing-file":
              console.log(`→ analyzing ${event.filePath}`);
              break;
            case "skip-file":
              console.log(`↷ skipping ${event.filePath}: ${event.reason}`);
              break;
            case "model-call":
              console.log(`⇢ model attempt ${event.attempt} for ${event.filePath}`);
              console.log(event.prompt);
              break;
            case "model-success":
              console.log(
                `⇡ model success for ${event.filePath} (attempt ${event.attempt}, ${event.lineCount} lines)`
              );
              break;
            case "warning":
              console.warn(
                `[warn] ${event.filePath ? `${event.filePath}: ` : ""}${event.message}`
              );
              break;
          }
        },
      });

      if (result.warnings.length > 0) {
        console.error("Warnings:");
        for (const warning of result.warnings) {
          console.error(`- ${warning}`);
        }
      }

      const formatted = formatHeatmapEntries(result.entries);
      const limited =
        limitOption.value !== undefined
          ? formatted.slice(0, limitOption.value)
          : formatted;

      if (options.json) {
        console.log(JSON.stringify(limited, null, 2));
        return;
      }

      if (limited.length === 0) {
        console.log("No additions were flagged for review.");
        return;
      }

      for (const line of limited) {
        console.log(line);
      }
    } catch (error) {
      if (error instanceof HeatmapError) {
        console.error(error.message);
      } else {
        console.error("Unexpected error", error);
      }
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error("Failed to parse command line options.", error);
  process.exit(1);
});
