import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import { spawn } from "node:child_process";
import { serverLogger } from "./utils/fileLogger.js";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

// Define the schema for the crown evaluation response
const CrownEvaluationResponseSchema = z.object({
  winner: z.number().int().min(0),
  reason: z.string(),
});

type CrownEvaluationResponse = z.infer<typeof CrownEvaluationResponseSchema>;

export async function evaluateCrownWithClaudeCode(
  convex: ConvexHttpClient,
  taskId: Id<"tasks">
): Promise<void> {
  serverLogger.info(`[CrownEvaluator] =================================================`);
  serverLogger.info(`[CrownEvaluator] STARTING CROWN EVALUATION FOR TASK ${taskId}`);
  serverLogger.info(`[CrownEvaluator] =================================================`);

  // Get task and runs
  const task = await convex.query(api.tasks.getById, { id: taskId });
  if (!task) {
    throw new Error("Task not found");
  }

  const taskRuns = await convex.query(api.taskRuns.getByTask, { taskId });
  const completedRuns = taskRuns.filter(run => run.status === "completed");

  if (completedRuns.length < 2) {
    serverLogger.info(`[CrownEvaluator] Not enough completed runs (${completedRuns.length})`);
    return;
  }

  // Prepare evaluation data
  const candidateData = completedRuns.map((run, idx) => {
    // Extract agent name from prompt
    const agentMatch = run.prompt.match(/\(([^)]+)\)$/);
    const agentName = agentMatch ? agentMatch[1] : "Unknown";

    // Extract git diff from log - look for the dedicated GIT DIFF section
    let gitDiff = "No changes detected";
    
    // Look for our well-defined git diff section
    const gitDiffMatch = run.log.match(/=== GIT DIFF ===\n([\s\S]*?)\n=== END GIT DIFF ===/);
    if (gitDiffMatch && gitDiffMatch[1]) {
      gitDiff = gitDiffMatch[1].trim();
      serverLogger.info(`[CrownEvaluator] Found git diff in standard format for ${agentName}: ${gitDiff.length} chars`);
    } else {
      // If no git diff section found, this is a serious problem
      serverLogger.error(`[CrownEvaluator] NO GIT DIFF SECTION FOUND for ${agentName}!`);
      serverLogger.error(`[CrownEvaluator] Log length: ${run.log.length}`);
      serverLogger.error(`[CrownEvaluator] Log contains "=== GIT DIFF ==="?: ${run.log.includes("=== GIT DIFF ===")}`)
      serverLogger.error(`[CrownEvaluator] Log contains "=== END GIT DIFF ==="?: ${run.log.includes("=== END GIT DIFF ===")}`)
      
      // As a last resort, check if there's any indication of changes
      if (run.log.includes("=== ALL STAGED CHANGES") || 
          run.log.includes("=== AGGRESSIVE DIFF CAPTURE") ||
          run.log.includes("ERROR: git diff --cached was empty")) {
        // Use whatever we can find
        const lastPart = run.log.slice(-3000);
        gitDiff = `ERROR: Git diff not properly captured. Last part of log:\n${lastPart}`;
      }
    }
    
    // Limit to 5000 chars for the prompt
    if (gitDiff.length > 5000) {
      gitDiff = gitDiff.substring(0, 5000) + "\n... (truncated)";
    }

    serverLogger.info(`[CrownEvaluator] Implementation ${idx} (${agentName}): ${gitDiff.length} chars of diff`);
    
    // Log last 500 chars of the run log to debug
    serverLogger.info(`[CrownEvaluator] ${agentName} log tail: ...${run.log.slice(-500)}`);

    return {
      index: idx,
      runId: run._id,
      agentName,
      exitCode: run.exitCode || 0,
      gitDiff,
    };
  });

  // Log what we found for debugging
  for (const c of candidateData) {
    serverLogger.info(`[CrownEvaluator] ${c.agentName} diff preview: ${c.gitDiff.substring(0, 200)}...`);
    
    if (c.gitDiff === "No changes detected" || c.gitDiff.startsWith("ERROR:")) {
      serverLogger.error(`[CrownEvaluator] WARNING: ${c.agentName} has no valid git diff!`);
    }
  }

  // Create evaluation prompt
  const evaluationPrompt = `Analyze these code implementations and select the best one.

${candidateData
  .map(
    (candidate) => `=== Implementation ${candidate.index} (${candidate.agentName}) ===
${candidate.gitDiff}
===END===
`
  )
  .join("\n")}

You MUST respond with ONLY this exact JSON format:
{"winner": 0, "reason": "explanation here"}

The winner field must be 0 or 1 (the index of the best implementation).
Pick the implementation with better code quality, more complete solution, or any actual changes.
If one has changes and the other doesn't, pick the one with changes.`;

  serverLogger.info(`[CrownEvaluator] Evaluation prompt length: ${evaluationPrompt.length} characters`);
  serverLogger.info(`[CrownEvaluator] Starting Claude Code spawn...`);
  const startTime = Date.now();

  // Try multiple approaches to run claude-code
  let stdout = "";
  let stderr = "";
  let exitCode = -1;

  // First try: npx
  try {
    serverLogger.info(`[CrownEvaluator] Attempting to run with npx...`);
    const npxProcess = spawn("npx", [
      "-y",  // Automatically install if needed
      "@anthropic-ai/claude-code",
      "--model", "claude-sonnet-4-20250514",
      "--dangerously-skip-permissions",
      "-p",
      evaluationPrompt
    ], {
      env: { 
        ...process.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false
    });

    stdout = "";
    stderr = "";

    npxProcess.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      serverLogger.info(`[CrownEvaluator] stdout: ${chunk.substring(0, 100)}...`);
    });

    npxProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      serverLogger.info(`[CrownEvaluator] stderr: ${chunk}`);
    });

    exitCode = await new Promise<number>((resolve, reject) => {
      let processExited = false;
      
      npxProcess.on("close", (code) => {
        processExited = true;
        resolve(code || 0);
      });

      npxProcess.on("error", (err) => {
        processExited = true;
        reject(err);
      });

      setTimeout(() => {
        if (!processExited) {
          npxProcess.kill('SIGKILL');
          reject(new Error("Timeout"));
        }
      }, 90000); // 90 second timeout
    });

    serverLogger.info(`[CrownEvaluator] npx completed with exit code ${exitCode}`);
  } catch (error) {
    serverLogger.error(`[CrownEvaluator] npx approach failed:`, error);
    
    // Second try: bunx
    try {
      serverLogger.info(`[CrownEvaluator] Attempting to run with bunx...`);
      const bunxProcess = spawn("bunx", [
        "@anthropic-ai/claude-code",
        "--model", "claude-sonnet-4-20250514", 
        "--dangerously-skip-permissions",
        "-p",
        evaluationPrompt
      ], {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      stdout = "";
      stderr = "";

      bunxProcess.stdout.on("data", (data) => {
        const chunk = data.toString();
        stdout += chunk;
        serverLogger.info(`[CrownEvaluator] stdout: ${chunk.substring(0, 100)}...`);
      });

      bunxProcess.stderr.on("data", (data) => {
        const chunk = data.toString();
        stderr += chunk;
        serverLogger.info(`[CrownEvaluator] stderr: ${chunk}`);
      });

      exitCode = await new Promise<number>((resolve, reject) => {
        let processExited = false;
        
        bunxProcess.on("close", (code) => {
          processExited = true;
          resolve(code || 0);
        });

        bunxProcess.on("error", (err) => {
          processExited = true;
          reject(err);
        });

        setTimeout(() => {
          if (!processExited) {
            bunxProcess.kill('SIGKILL');
            reject(new Error("Timeout"));
          }
        }, 90000);
      });

      serverLogger.info(`[CrownEvaluator] bunx completed with exit code ${exitCode}`);
    } catch (bunxError) {
      serverLogger.error(`[CrownEvaluator] bunx approach also failed:`, bunxError);
      throw new Error("Could not run Claude Code via npx or bunx. Please ensure @anthropic-ai/claude-code is available.");
    }
  }

  serverLogger.info(`[CrownEvaluator] Process completed after ${Date.now() - startTime}ms`);
  serverLogger.info(`[CrownEvaluator] Exit code: ${exitCode}`);
  serverLogger.info(`[CrownEvaluator] Stdout length: ${stdout.length}`);
  serverLogger.info(`[CrownEvaluator] Full stdout:\n${stdout}`);

  if (exitCode !== 0) {
    throw new Error(`Claude Code exited with error code ${exitCode}. Stderr: ${stderr}`);
  }

  // Parse the response
  let jsonResponse: CrownEvaluationResponse;
  
  // Try to extract JSON from stdout
  const jsonMatch = stdout.match(/\{[^{}]*"winner"\s*:\s*\d+[^{}]*"reason"\s*:\s*"[^"]*"[^{}]*\}/);
  if (!jsonMatch) {
    serverLogger.error(`[CrownEvaluator] No JSON found in output. Full stdout:\n${stdout}`);
    
    // Try to find just a number
    const numberMatch = stdout.match(/\b([01])\b/);
    if (numberMatch) {
      const index = parseInt(numberMatch[1], 10);
      jsonResponse = {
        winner: index,
        reason: "Selected based on implementation quality"
      };
      serverLogger.info(`[CrownEvaluator] Extracted winner index ${index} from output`);
    } else {
      throw new Error("Claude Code did not return a valid response");
    }
  } else {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      jsonResponse = CrownEvaluationResponseSchema.parse(parsed);
      serverLogger.info(`[CrownEvaluator] Successfully parsed JSON response: ${JSON.stringify(jsonResponse)}`);
    } catch (parseError) {
      serverLogger.error(`[CrownEvaluator] Failed to parse JSON:`, parseError);
      throw new Error("Invalid JSON response from Claude Code");
    }
  }

  // Validate winner index
  if (jsonResponse.winner >= candidateData.length) {
    throw new Error(`Invalid winner index ${jsonResponse.winner}, must be less than ${candidateData.length}`);
  }

  const winner = candidateData[jsonResponse.winner];
  serverLogger.info(`[CrownEvaluator] WINNER SELECTED: ${winner.agentName} (index ${jsonResponse.winner})`);
  serverLogger.info(`[CrownEvaluator] Reason: ${jsonResponse.reason}`);

  // Update the database
  await convex.mutation(api.crown.setCrownWinner, {
    taskRunId: winner.runId,
    reason: jsonResponse.reason,
  });

  // Clear any error
  await convex.mutation(api.tasks.updateCrownError, {
    id: taskId,
    crownEvaluationError: undefined,
  });

  serverLogger.info(`[CrownEvaluator] Crown evaluation completed successfully for task ${taskId}`);
}