import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import { spawn } from "node:child_process";
import { serverLogger } from "./utils/fileLogger.js";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { VSCodeInstance } from "./vscode/VSCodeInstance.js";
import { io, type Socket } from "socket.io-client";
import type { WorkerToServerEvents, ServerToWorkerEvents } from "@cmux/shared";

// Define schemas for structured output
const ImplementationSchema = z.object({
  modelName: z.string(),
  gitDiff: z.string(),
  index: z.number(),
});

const CrownEvaluationRequestSchema = z.object({
  implementations: z.array(ImplementationSchema),
});

const CrownEvaluationResponseSchema = z.object({
  winner: z.number().int().min(0),
  reason: z.string(),
});

type CrownEvaluationResponse = z.infer<typeof CrownEvaluationResponseSchema>;

async function createPullRequestForWinner(
  convex: ConvexHttpClient,
  taskRunId: Id<"taskRuns">,
  taskId: Id<"tasks">
): Promise<void> {
  try {
    serverLogger.info(`[CrownEvaluator] Creating pull request for winner ${taskRunId}`);
    
    // Get the task run details
    const taskRun = await convex.query(api.taskRuns.get, { id: taskRunId });
    if (!taskRun || !taskRun.vscode?.containerName) {
      serverLogger.error(`[CrownEvaluator] No VSCode instance found for task run ${taskRunId}`);
      return;
    }
    
    // Get the task details
    const task = await convex.query(api.tasks.getById, { id: taskId });
    if (!task) {
      serverLogger.error(`[CrownEvaluator] Task ${taskId} not found`);
      return;
    }
    
    // Find the VSCode instance
    const instances = VSCodeInstance.getInstances();
    let vscodeInstance = null;
    let workerSocket = null;
    
    // Look for the instance by taskRunId
    for (const [id, instance] of instances) {
      if (instance.getTaskRunId() === taskRunId) {
        vscodeInstance = instance;
        workerSocket = instance.getWorkerSocket();
        break;
      }
    }
    
    if (!vscodeInstance || !workerSocket || !vscodeInstance.isWorkerConnected()) {
      serverLogger.error(`[CrownEvaluator] VSCode instance not found or not connected for task run ${taskRunId}`);
      return;
    }
    
    // Extract agent name from prompt
    const agentMatch = taskRun.prompt.match(/\(([^)]+)\)$/);
    const agentName = agentMatch ? agentMatch[1] : "Unknown";
    
    // Create PR title and body with proper escaping
    const prTitle = (task.text || "Task completed by cmux").replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const prBody = `## Summary
- Task completed by ${agentName} agent 🏆
- ${taskRun.crownReason || "Selected as the best implementation"}

## Details
- Task ID: ${taskId}
- Agent: ${agentName}
- Completed: ${new Date().toISOString()}

---
🤖 Generated with [cmux](https://github.com/lawrencecchen/cmux)`;
    
    // Create branch name
    const branchName = `cmux-${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${taskRunId.slice(-8)}`;
    
    // Escape the PR body for shell
    const escapedPrBody = prBody.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, '\\n');
    
    // Commands to create PR
    const commands = [
      `cd /root/workspace`,
      `git checkout -b ${branchName}`,
      `git add -A`,
      `git commit -m "${prTitle}

Completed by ${agentName} agent

🤖 Generated with cmux"`,
      `git push -u origin ${branchName}`,
      `gh pr create --title "${prTitle}" --body "${escapedPrBody}" --web`
    ];
    
    serverLogger.info(`[CrownEvaluator] Executing PR creation commands...`);
    
    // We need to get the terminal ID from the task run or create a new terminal
    // For now, we'll send commands to the main terminal (terminal ID is usually the taskRunId)
    const terminalId = taskRunId;
    
    // Execute commands sequentially
    for (const command of commands) {
      await new Promise<void>((resolve) => {
        const terminalData = {
          terminalId: terminalId,
          data: command + '\n'
        };
        
        // Use worker:terminal-input to send commands
        workerSocket.emit('worker:terminal-input', terminalData);
        serverLogger.info(`[CrownEvaluator] Sent command: ${command}`);
        
        // Give each command time to execute
        setTimeout(resolve, 3000);
      });
    }
    
    serverLogger.info(`[CrownEvaluator] Pull request creation commands sent`);
    
    // Note: The actual PR URL will be captured from the terminal output
    // and updated via a separate mechanism
    
  } catch (error) {
    serverLogger.error(`[CrownEvaluator] Error creating pull request:`, error);
  }
}

export async function evaluateCrownWithClaudeCode(
  convex: ConvexHttpClient,
  taskId: Id<"tasks">
): Promise<void> {
  serverLogger.info(`[CrownEvaluator] =================================================`);
  serverLogger.info(`[CrownEvaluator] STARTING CROWN EVALUATION FOR TASK ${taskId}`);
  serverLogger.info(`[CrownEvaluator] =================================================`);

  try {
    // Get task and runs
    const task = await convex.query(api.tasks.getById, { id: taskId });
    if (!task) {
      throw new Error("Task not found");
    }

    const taskRuns = await convex.query(api.taskRuns.getByTask, { taskId });
    const completedRuns = taskRuns.filter((run: any) => run.status === "completed");

  if (completedRuns.length < 2) {
    serverLogger.info(`[CrownEvaluator] Not enough completed runs (${completedRuns.length})`);
    return;
  }
  
  // Double-check if evaluation already exists
  const existingEvaluation = await convex.query(api.crown.getCrownEvaluation, {
    taskId: taskId,
  });
  
  if (existingEvaluation) {
    serverLogger.info(`[CrownEvaluator] Crown evaluation already exists for task ${taskId}, skipping`);
    // Clear the pending status
    await convex.mutation(api.tasks.updateCrownError, {
      id: taskId,
      crownEvaluationError: undefined,
    });
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

  // Create structured data for the evaluation
  const evaluationData = {
    implementations: candidateData.map((candidate, idx) => ({
      modelName: candidate.agentName,
      gitDiff: candidate.gitDiff,
      index: idx,
    })),
  };

  // Create evaluation prompt with structured output request
  const evaluationPrompt = `You are evaluating code implementations from different AI models.

Here are the implementations to evaluate:
${JSON.stringify(evaluationData, null, 2)}

Analyze these implementations and select the best one based on:
1. Code quality and correctness
2. Completeness of the solution
3. Following best practices
4. Actually having changes (if one has no changes, prefer the one with changes)

Respond with a JSON object containing:
- "winner": the index (0-based) of the best implementation
- "reason": a brief explanation of why this implementation was chosen

Example response:
{"winner": 0, "reason": "Model claude/sonnet-4 provided a more complete implementation with better error handling and cleaner code structure."}

IMPORTANT: Respond ONLY with the JSON object, no other text.`;

  serverLogger.info(`[CrownEvaluator] Evaluation prompt length: ${evaluationPrompt.length} characters`);
  
  // Log prompt structure for debugging
  const promptLines = evaluationPrompt.split('\n');
  serverLogger.info(`[CrownEvaluator] Prompt has ${promptLines.length} lines`);
  serverLogger.info(`[CrownEvaluator] First 5 lines of prompt:`);
  promptLines.slice(0, 5).forEach((line, idx) => {
    serverLogger.info(`[CrownEvaluator]   ${idx}: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
  });
  
  serverLogger.info(`[CrownEvaluator] Starting Claude Code spawn...`);
  const startTime = Date.now();

  // Try multiple approaches to run claude-code
  let stdout = "";
  let stderr = "";
  let exitCode = -1;

  // Only use bunx since npx consistently times out
  try {
    serverLogger.info(`[CrownEvaluator] Attempting to run with bunx...`);
    
    // Use --print flag for non-interactive output, just like the agents but with --print
    const args = [
      "@anthropic-ai/claude-code",
      "--model", "claude-sonnet-4-20250514", 
      "--dangerously-skip-permissions",
      "--print",
      evaluationPrompt
    ];
    
    serverLogger.info(`[CrownEvaluator] Command: bunx ${args.slice(0, 4).join(' ')} [prompt]`);
    
    const bunxProcess = spawn("bunx", args, {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false
    });

    serverLogger.info(`[CrownEvaluator] Process spawned with PID: ${bunxProcess.pid}`);

    // Close stdin since we're passing prompt as an argument
    bunxProcess.stdin.end();
    
    stdout = "";
    stderr = "";
    
    // Track if we've received any data
    let receivedStdout = false;
    let receivedStderr = false;
    let lastStderr = "";

    bunxProcess.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      receivedStdout = true;
      serverLogger.info(`[CrownEvaluator] stdout (${chunk.length} chars): ${chunk.substring(0, 200)}`);
    });

    bunxProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      lastStderr = chunk;
      receivedStderr = true;
      
      // Log all stderr to debug the issue
      serverLogger.info(`[CrownEvaluator] stderr: ${chunk.trim()}`);
    });
    
    // Add more detailed event handlers
    bunxProcess.on("exit", (code, signal) => {
      serverLogger.info(`[CrownEvaluator] Process exited with code ${code} and signal ${signal}`);
      serverLogger.info(`[CrownEvaluator] Exit occurred after ${Date.now() - startTime}ms`);
    });
    
    bunxProcess.on("error", (error) => {
      serverLogger.error(`[CrownEvaluator] Process spawn error:`, error);
    });

    exitCode = await new Promise<number>((resolve, reject) => {
      let processExited = false;
      
      bunxProcess.on("close", (code) => {
        processExited = true;
        serverLogger.info(`[CrownEvaluator] Process closed with code: ${code}`);
        serverLogger.info(`[CrownEvaluator] Received stdout: ${receivedStdout}, Received stderr: ${receivedStderr}`);
        serverLogger.info(`[CrownEvaluator] Total stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
        
        if (stderr.length > 0) {
          serverLogger.info(`[CrownEvaluator] Full stderr output:`);
          stderr.split('\n').forEach((line, idx) => {
            if (line.trim()) {
              serverLogger.info(`[CrownEvaluator]   stderr[${idx}]: ${line}`);
            }
          });
        }
        
        if (lastStderr.includes("Saved lockfile") && stdout.length === 0) {
          serverLogger.error(`[CrownEvaluator] Process failed after saving lockfile with no output`);
          serverLogger.error(`[CrownEvaluator] This suggests Claude Code started but failed to execute`);
        }
        
        resolve(code || 0);
      });

      bunxProcess.on("error", (err) => {
        processExited = true;
        serverLogger.error(`[CrownEvaluator] Process error: ${err.message}`);
        reject(err);
      });

      setTimeout(() => {
        if (!processExited) {
          serverLogger.error(`[CrownEvaluator] Process timeout after 90 seconds, killing...`);
          bunxProcess.kill('SIGKILL');
          reject(new Error("Timeout"));
        }
      }, 90000);
    });

    serverLogger.info(`[CrownEvaluator] bunx completed with exit code ${exitCode}`);
  } catch (bunxError) {
    serverLogger.error(`[CrownEvaluator] bunx failed:`, bunxError);
    throw new Error("Could not run Claude Code via bunx. Please ensure @anthropic-ai/claude-code is available.");
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
  
  // Try to extract JSON from stdout - look for any JSON object with winner and reason
  const jsonMatch = stdout.match(/\{[^{}]*"winner"\s*:\s*\d+[^{}]*"reason"\s*:\s*"[^"]*"[^{}]*\}/) ||
                    stdout.match(/\{[^{}]*"reason"\s*:\s*"[^"]*"[^{}]*"winner"\s*:\s*\d+[^{}]*\}/);
  
  if (!jsonMatch) {
    serverLogger.error(`[CrownEvaluator] No JSON found in output. Full stdout:\n${stdout}`);
    
    // Try to find a complete JSON object anywhere in the output
    try {
      // Remove any non-JSON content before/after
      const possibleJson = stdout.substring(
        stdout.indexOf('{'), 
        stdout.lastIndexOf('}') + 1
      );
      const parsed = JSON.parse(possibleJson);
      jsonResponse = CrownEvaluationResponseSchema.parse(parsed);
      serverLogger.info(`[CrownEvaluator] Extracted JSON from output: ${JSON.stringify(jsonResponse)}`);
    } catch {
      // Last resort - try to find just a number
      const numberMatch = stdout.match(/\b([01])\b/);
      if (numberMatch) {
        const index = parseInt(numberMatch[1], 10);
        jsonResponse = {
          winner: index,
          reason: `Selected ${candidateData[index].agentName} based on implementation quality`
        };
        serverLogger.info(`[CrownEvaluator] Extracted winner index ${index} from output`);
      } else {
        throw new Error("Claude Code did not return a valid response");
      }
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
  
  // Create pull request for the winner
  await createPullRequestForWinner(convex, winner.runId, taskId);
  } catch (error) {
    serverLogger.error(`[CrownEvaluator] Error during evaluation:`, error);
    
    // Update task with error status
    await convex.mutation(api.tasks.updateCrownError, {
      id: taskId,
      crownEvaluationError: `Failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    
    throw error;
  }
}