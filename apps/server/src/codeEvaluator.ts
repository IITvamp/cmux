import type { Id, Doc } from "@cmux/convex/dataModel";
import { api } from "@cmux/convex/api";
import { ConvexHttpClient } from "convex/browser";
import { VSCodeInstance } from "./vscode/VSCodeInstance.js";
import { DockerVSCodeInstance } from "./vscode/DockerVSCodeInstance.js";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

interface CodeSolution {
  taskRunId: Id<"taskRuns">;
  agentName: string;
  diff: string;
  testResults?: {
    passed: number;
    failed: number;
    errors: string[];
  };
  lintResults?: {
    errors: number;
    warnings: number;
    details: string[];
  };
}

interface EvaluationCriteria {
  codeQuality: number; // 0-10
  testCoverage: number; // 0-10
  effectiveness: number; // 0-10
  bestPractices: number; // 0-10
  performance: number; // 0-10
  reasoning: string;
  totalScore: number;
}

/**
 * Evaluates multiple code solutions and selects the best one
 */
export async function evaluateAndSelectBestSolution(
  taskId: Id<"tasks">,
  taskDescription: string,
  taskRuns: Doc<"taskRuns">[],
  vscodeInstances: Map<string, VSCodeInstance>,
  convex: ConvexHttpClient
): Promise<{
  bestSolution: CodeSolution;
  evaluations: Map<string, EvaluationCriteria>;
}> {
  console.log(`[CodeEvaluator] Starting evaluation for ${taskRuns.length} solutions`);

  // Collect all solutions with their diffs and test results
  const solutions: CodeSolution[] = [];
  
  for (const taskRun of taskRuns) {
    if (taskRun.status !== "completed") continue;
    
    const vscodeInstance = vscodeInstances.get(taskRun._id);
    if (!vscodeInstance) continue;
    
    try {
      // Get the git diff for this solution
      const diff = await getGitDiff(vscodeInstance);
      if (!diff || diff.trim() === "") continue;
      
      // Run tests if available
      const testResults = await runTests(vscodeInstance);
      
      // Run linter if available
      const lintResults = await runLinter(vscodeInstance);
      
      // Extract agent name from prompt (format: "task description (agent name)")
      const agentNameMatch = taskRun.prompt.match(/\(([^)]+)\)$/);
      const agentName = agentNameMatch ? agentNameMatch[1] : "Unknown";
      
      solutions.push({
        taskRunId: taskRun._id,
        agentName,
        diff,
        testResults,
        lintResults
      });
    } catch (error) {
      console.error(`[CodeEvaluator] Error collecting solution for ${taskRun._id}:`, error);
    }
  }
  
  if (solutions.length === 0) {
    throw new Error("No valid solutions found to evaluate");
  }
  
  // Use LLM to evaluate each solution
  const evaluations = await evaluateSolutions(solutions, taskDescription);
  
  // Select the best solution based on scores
  let bestSolution: CodeSolution | null = null;
  let bestScore = -1;
  let bestEvaluation: EvaluationCriteria | null = null;
  
  // Also track second best for comparison
  let secondBestScore = -1;
  let secondBestAgent = "";
  
  for (const solution of solutions) {
    const evaluation = evaluations.get(solution.taskRunId);
    if (evaluation && evaluation.totalScore > bestScore) {
      // Move current best to second best
      secondBestScore = bestScore;
      if (bestSolution) secondBestAgent = bestSolution.agentName;
      
      bestScore = evaluation.totalScore;
      bestSolution = solution;
      bestEvaluation = evaluation;
    } else if (evaluation && evaluation.totalScore > secondBestScore) {
      secondBestScore = evaluation.totalScore;
      secondBestAgent = solution.agentName;
    }
  }
  
  if (!bestSolution || !bestEvaluation) {
    throw new Error("Could not determine best solution");
  }
  
  console.log(`[CodeEvaluator] Selected ${bestSolution.agentName} as best solution with score ${bestScore}/50`);
  if (secondBestAgent) {
    console.log(`[CodeEvaluator] Runner-up: ${secondBestAgent} with score ${secondBestScore}/50 (difference: ${bestScore - secondBestScore})`);
  }
  console.log(`[CodeEvaluator] Reasoning: ${bestEvaluation.reasoning}`);
  
  return { bestSolution, evaluations };
}

/**
 * Get git diff from VSCode instance
 */
async function getGitDiff(vscodeInstance: VSCodeInstance): Promise<string> {
  const workerSocket = vscodeInstance.getWorkerSocket();
  if (!workerSocket || !vscodeInstance.isWorkerConnected()) {
    throw new Error("No worker connection available");
  }
  
  return new Promise((resolve, reject) => {
    workerSocket
      .timeout(30000)
      .emit(
        "worker:exec",
        {
          command: "git",
          args: ["diff", "--cached", "HEAD"],
          cwd: "/root/workspace",
          env: {},
        },
        (timeoutError: any, result: any) => {
          if (timeoutError) {
            reject(new Error("Timeout getting git diff"));
            return;
          }
          if (result.error) {
            reject(new Error(result.error.message));
            return;
          }
          
          // If no staged changes, get unstaged changes
          if (!result.data.stdout || result.data.stdout.trim() === "") {
            workerSocket
              .timeout(30000)
              .emit(
                "worker:exec",
                {
                  command: "git",
                  args: ["diff", "HEAD"],
                  cwd: "/root/workspace",
                  env: {},
                },
                (timeoutError2: any, result2: any) => {
                  if (timeoutError2 || result2.error) {
                    resolve("");
                    return;
                  }
                  resolve(result2.data.stdout || "");
                }
              );
          } else {
            resolve(result.data.stdout);
          }
        }
      );
  });
}

/**
 * Run tests in VSCode instance
 */
async function runTests(vscodeInstance: VSCodeInstance): Promise<CodeSolution["testResults"] | undefined> {
  const workerSocket = vscodeInstance.getWorkerSocket();
  if (!workerSocket || !vscodeInstance.isWorkerConnected()) {
    return undefined;
  }
  
  // Try common test commands
  const testCommands = [
    { command: "npm", args: ["test"] },
    { command: "yarn", args: ["test"] },
    { command: "pnpm", args: ["test"] },
    { command: "bun", args: ["test"] },
    { command: "pytest", args: [] },
    { command: "cargo", args: ["test"] },
  ];
  
  for (const testCmd of testCommands) {
    try {
      const result = await new Promise<any>((resolve) => {
        workerSocket
          .timeout(60000) // 1 minute timeout for tests
          .emit(
            "worker:exec",
            {
              command: testCmd.command,
              args: testCmd.args,
              cwd: "/root/workspace",
              env: {},
            },
            (timeoutError: any, result: any) => {
              if (timeoutError || result.error) {
                resolve(null);
                return;
              }
              resolve(result.data);
            }
          );
      });
      
      if (result && result.exitCode === 0) {
        // Parse test output (simplified - would need more sophisticated parsing)
        const output = result.stdout + result.stderr;
        const passedMatch = output.match(/(\d+) passed/i);
        const failedMatch = output.match(/(\d+) failed/i);
        
        return {
          passed: passedMatch ? parseInt(passedMatch[1]) : 0,
          failed: failedMatch ? parseInt(failedMatch[1]) : 0,
          errors: []
        };
      }
    } catch (error) {
      // Continue to next test command
    }
  }
  
  return undefined;
}

/**
 * Run linter in VSCode instance
 */
async function runLinter(vscodeInstance: VSCodeInstance): Promise<CodeSolution["lintResults"] | undefined> {
  const workerSocket = vscodeInstance.getWorkerSocket();
  if (!workerSocket || !vscodeInstance.isWorkerConnected()) {
    return undefined;
  }
  
  // Try common lint commands
  const lintCommands = [
    { command: "npm", args: ["run", "lint"] },
    { command: "yarn", args: ["lint"] },
    { command: "pnpm", args: ["lint"] },
    { command: "bun", args: ["run", "lint"] },
    { command: "eslint", args: ["."] },
    { command: "ruff", args: ["check", "."] },
  ];
  
  for (const lintCmd of lintCommands) {
    try {
      const result = await new Promise<any>((resolve) => {
        workerSocket
          .timeout(30000)
          .emit(
            "worker:exec",
            {
              command: lintCmd.command,
              args: lintCmd.args,
              cwd: "/root/workspace",
              env: {},
            },
            (timeoutError: any, result: any) => {
              if (timeoutError) {
                resolve(null);
                return;
              }
              resolve(result.data);
            }
          );
      });
      
      if (result) {
        // Parse lint output (simplified)
        const output = result.stdout + result.stderr;
        const errorMatch = output.match(/(\d+) error/i);
        const warningMatch = output.match(/(\d+) warning/i);
        
        return {
          errors: errorMatch ? parseInt(errorMatch[1]) : 0,
          warnings: warningMatch ? parseInt(warningMatch[1]) : 0,
          details: []
        };
      }
    } catch (error) {
      // Continue to next lint command
    }
  }
  
  return undefined;
}

/**
 * Use Claude Sonnet to evaluate and compare code solutions
 */
async function evaluateSolutions(
  solutions: CodeSolution[],
  taskDescription: string
): Promise<Map<string, EvaluationCriteria>> {
  const evaluations = new Map<string, EvaluationCriteria>();
  
  // First, use heuristics as a fallback
  for (const solution of solutions) {
    const heuristicEval = evaluateSolutionHeuristics(solution);
    evaluations.set(solution.taskRunId, heuristicEval);
  }
  
  // Try to use Claude Sonnet for more intelligent evaluation
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    console.log("[CodeEvaluator] No Anthropic API key found, using heuristic evaluation only");
    return evaluations;
  }
  
  try {
    // Prepare the code solutions for comparison
    const solutionSummaries = solutions.map((sol, idx) => {
      const testInfo = sol.testResults 
        ? `Tests: ${sol.testResults.passed} passed, ${sol.testResults.failed} failed`
        : "No tests run";
      const lintInfo = sol.lintResults
        ? `Lint: ${sol.lintResults.errors} errors, ${sol.lintResults.warnings} warnings`
        : "No linting performed";
      
      return `
Solution ${idx + 1} (${sol.agentName}):
${testInfo}
${lintInfo}

Code changes:
\`\`\`diff
${sol.diff.substring(0, 1500)}${sol.diff.length > 1500 ? '\n... (truncated)' : ''}
\`\`\`
`;
    }).join('\n---\n');
    
    // Use Claude to evaluate all solutions
    const result = await generateObject({
      model: anthropic('claude-3-5-sonnet-20241022'),
      schema: z.object({
        evaluations: z.array(z.object({
          solutionIndex: z.number().describe("0-based index of the solution"),
          agentName: z.string(),
          codeQuality: z.number().min(0).max(10).describe("Code quality, readability, and maintainability score"),
          testCoverage: z.number().min(0).max(10).describe("Test coverage and test quality score"),
          effectiveness: z.number().min(0).max(10).describe("How well the solution solves the stated task"),
          bestPractices: z.number().min(0).max(10).describe("Adherence to language/framework best practices"),
          performance: z.number().min(0).max(10).describe("Code efficiency and performance considerations"),
          reasoning: z.string().describe("Brief explanation of the scores and why this solution was ranked as it was")
        })),
        bestSolutionIndex: z.number().describe("Index of the best solution (0-based)"),
        overallAnalysis: z.string().describe("Overall comparison and why the best solution was chosen")
      }),
      prompt: `You are a code quality expert. Evaluate the following code solutions for this task:

Task: ${taskDescription}

${solutionSummaries}

Evaluate each solution on:
1. Code Quality (0-10): Clean, readable, maintainable code
2. Test Coverage (0-10): Well-tested solution with good test quality
3. Effectiveness (0-10): How well it solves the stated task
4. Best Practices (0-10): Follows language/framework conventions
5. Performance (0-10): Efficient implementation

Consider test results and linting errors heavily in your evaluation. Solutions with failing tests should score lower on effectiveness.

Provide detailed evaluation for each solution and identify which one is the best overall.`
    });
    
    // Update evaluations with Claude's scores
    result.object.evaluations.forEach((evalResult: any, idx: number) => {
      if (idx < solutions.length) {
        const solution = solutions[idx];
        const totalScore = evalResult.codeQuality + evalResult.testCoverage + evalResult.effectiveness + evalResult.bestPractices + evalResult.performance;
        
        evaluations.set(solution.taskRunId, {
          codeQuality: evalResult.codeQuality,
          testCoverage: evalResult.testCoverage,
          effectiveness: evalResult.effectiveness,
          bestPractices: evalResult.bestPractices,
          performance: evalResult.performance,
          reasoning: evalResult.reasoning,
          totalScore
        });
      }
    });
    
    console.log(`[CodeEvaluator] Claude evaluation complete. Best solution: ${solutions[result.object.bestSolutionIndex]?.agentName}`);
    console.log(`[CodeEvaluator] Analysis: ${result.object.overallAnalysis}`);
    
  } catch (error) {
    console.error("[CodeEvaluator] Error using Claude for evaluation:", error);
    console.log("[CodeEvaluator] Falling back to heuristic evaluation");
  }
  
  return evaluations;
}

/**
 * Evaluate a solution using heuristics
 */
function evaluateSolutionHeuristics(solution: CodeSolution): EvaluationCriteria {
  let codeQuality = 5; // Base score
  let testCoverage = 0;
  let effectiveness = 5; // Base score
  let bestPractices = 5; // Base score
  let performance = 5; // Base score
  const reasons: string[] = [];
  
  // Evaluate based on diff size (smaller focused changes are often better)
  const diffLines = solution.diff.split('\n').length;
  if (diffLines < 50) {
    codeQuality += 2;
    reasons.push("Focused, minimal changes");
  } else if (diffLines > 200) {
    codeQuality -= 1;
    reasons.push("Large diff may indicate unfocused changes");
  }
  
  // Evaluate test coverage
  if (solution.testResults) {
    if (solution.testResults.failed === 0 && solution.testResults.passed > 0) {
      testCoverage = 8;
      effectiveness += 2;
      reasons.push(`All ${solution.testResults.passed} tests passing`);
    } else if (solution.testResults.failed > 0) {
      testCoverage = 3;
      effectiveness -= 2;
      reasons.push(`${solution.testResults.failed} tests failing`);
    }
  } else {
    testCoverage = 0;
    reasons.push("No test results available");
  }
  
  // Evaluate lint results
  if (solution.lintResults) {
    if (solution.lintResults.errors === 0) {
      bestPractices += 3;
      codeQuality += 1;
      reasons.push("No linting errors");
    } else {
      bestPractices -= 2;
      reasons.push(`${solution.lintResults.errors} linting errors`);
    }
    
    if (solution.lintResults.warnings > 5) {
      bestPractices -= 1;
      reasons.push(`${solution.lintResults.warnings} linting warnings`);
    }
  }
  
  // Check for common good patterns in the diff
  const diffLower = solution.diff.toLowerCase();
  
  // Good patterns
  if (diffLower.includes('test') || diffLower.includes('spec')) {
    testCoverage += 2;
    reasons.push("Includes test changes");
  }
  if (diffLower.includes('error handling') || diffLower.includes('try') || diffLower.includes('catch')) {
    bestPractices += 1;
    reasons.push("Includes error handling");
  }
  if (diffLower.includes('todo') || diffLower.includes('fixme')) {
    codeQuality -= 1;
    reasons.push("Contains TODO/FIXME comments");
  }
  
  // Normalize scores to 0-10 range
  codeQuality = Math.max(0, Math.min(10, codeQuality));
  testCoverage = Math.max(0, Math.min(10, testCoverage));
  effectiveness = Math.max(0, Math.min(10, effectiveness));
  bestPractices = Math.max(0, Math.min(10, bestPractices));
  performance = Math.max(0, Math.min(10, performance));
  
  const totalScore = codeQuality + testCoverage + effectiveness + bestPractices + performance;
  
  return {
    codeQuality,
    testCoverage,
    effectiveness,
    bestPractices,
    performance,
    reasoning: reasons.join("; "),
    totalScore
  };
}

/**
 * Create a PR with the best solution
 */
export async function createPullRequestForBestSolution(
  bestSolution: CodeSolution,
  taskDescription: string,
  evaluation: EvaluationCriteria,
  vscodeInstance: VSCodeInstance,
  vscodeInstances: Map<string, VSCodeInstance>,
  convex: ConvexHttpClient
): Promise<void> {
  try {
    console.log(`[CodeEvaluator] Creating PR for best solution from ${bestSolution.agentName}`);
    
    // Create a unique branch name
    const sanitizedTaskDesc = taskDescription
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join('-')
      .substring(0, 30);
    
    const branchName = `cmux-best-${sanitizedTaskDesc}-${Date.now()}`;
    
    const commitMessage = `${taskDescription}

Selected best solution from ${bestSolution.agentName}

Evaluation scores:
- Code Quality: ${evaluation.codeQuality}/10
- Test Coverage: ${evaluation.testCoverage}/10
- Effectiveness: ${evaluation.effectiveness}/10
- Best Practices: ${evaluation.bestPractices}/10
- Performance: ${evaluation.performance}/10
- Total Score: ${evaluation.totalScore}/50

${evaluation.reasoning}

🤖 Generated with cmux - Best of ${bestSolution.agentName} solutions`;

    // Use the performAutoCommitAndPush function with evaluation
    await performAutoCommitAndPush(
      vscodeInstance, 
      { name: bestSolution.agentName }, 
      bestSolution.taskRunId, 
      taskDescription,
      evaluation,
      vscodeInstances,
      convex
    );
    
  } catch (error) {
    console.error(`[CodeEvaluator] Error creating PR:`, error);
    throw error;
  }
}

/**
 * Create commit and push for the best solution
 */
async function performAutoCommitAndPush(
  vscodeInstance: VSCodeInstance,
  agent: { name: string },
  taskRunId: string | Id<"taskRuns">,
  taskDescription: string,
  evaluation: EvaluationCriteria,
  vscodeInstances: Map<string, VSCodeInstance>,
  convex: ConvexHttpClient
): Promise<void> {
  try {
    console.log(`[CodeEvaluator] Starting auto-commit and push for best solution from ${agent.name}`);
    
    // Create a unique branch name
    const sanitizedTaskDesc = taskDescription
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join('-')
      .substring(0, 30);
    
    const branchName = `cmux-best-${sanitizedTaskDesc}-${Date.now()}`;
    
    // Get all agent names that participated
    const allAgents = Array.from(new Set(
      await Promise.all(
        Array.from(vscodeInstances.keys()).map(async (taskRunId) => {
          const taskRun = await convex.query(api.taskRuns.get, { id: taskRunId as Id<"taskRuns"> });
          const agentMatch = taskRun?.prompt.match(/\(([^)]+)\)$/);
          return agentMatch ? agentMatch[1] : "Unknown";
        })
      )
    ));
    
    const commitMessage = `${taskDescription}

Selected best solution from ${agent.name} out of ${allAgents.length} agents

Participating agents: ${allAgents.join(", ")}

Evaluation scores for ${agent.name}:
- Code Quality: ${evaluation.codeQuality}/10
- Test Coverage: ${evaluation.testCoverage}/10  
- Effectiveness: ${evaluation.effectiveness}/10
- Best Practices: ${evaluation.bestPractices}/10
- Performance: ${evaluation.performance}/10
- Total Score: ${evaluation.totalScore}/50

Evaluation reasoning: ${evaluation.reasoning}

🤖 Generated with cmux - AI-evaluated best solution using Claude Sonnet`;

    // Try to use VSCode extension API first
    const extensionResult = await tryVSCodeExtensionCommit(vscodeInstance, branchName, commitMessage, agent.name);
    
    if (extensionResult.success) {
      console.log(`[CodeEvaluator] Successfully committed via VSCode extension`);
      return;
    }

    console.log(`[CodeEvaluator] VSCode extension method failed, falling back to git commands`);
    
    // Fallback to direct git commands
    const workerSocket = vscodeInstance.getWorkerSocket();
    if (!workerSocket || !vscodeInstance.isWorkerConnected()) {
      console.log(`[CodeEvaluator] No worker connection for auto-commit fallback`);
      return;
    }
    
    // Execute git commands
    const gitCommands = [
      `git add .`,
      `git checkout -b ${branchName}`,
      `git commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
      `git push -u origin ${branchName}`
    ];

    for (const command of gitCommands) {
      console.log(`[CodeEvaluator] Executing: ${command}`);
      
      await new Promise<void>((resolve) => {
        workerSocket
          .timeout(30000)
          .emit(
            "worker:exec",
            {
              command: "bash",
              args: ["-c", command],
              cwd: "/root/workspace",
              env: {},
            },
            (timeoutError: any, result: any) => {
              if (timeoutError) {
                console.error(`[CodeEvaluator] Timeout executing: ${command}`, timeoutError);
              } else if (result.error) {
                console.error(`[CodeEvaluator] Error executing: ${command}`, result.error);
              } else {
                console.log(`[CodeEvaluator] Command output:`, result.data);
              }
              resolve();
            }
          );
      });
    }

    console.log(`[CodeEvaluator] Auto-commit and push completed for best solution on branch ${branchName}`);
    
    // Mark this solution as the selected one in the database
    try {
      await convex.mutation(api.taskRuns.markAsSelectedSolution, {
        id: taskRunId as Id<"taskRuns">
      });
      console.log(`[CodeEvaluator] Marked task run ${taskRunId} as selected solution`);
    } catch (error) {
      console.error(`[CodeEvaluator] Error marking selected solution:`, error);
    }
  } catch (error) {
    console.error(`[CodeEvaluator] Error in auto-commit and push:`, error);
  }
}

/**
 * Try to use VSCode extension API for git operations
 */
async function tryVSCodeExtensionCommit(
  vscodeInstance: VSCodeInstance,
  branchName: string,
  commitMessage: string,
  agentName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // For Docker instances, get the extension port
    let extensionPort: string | undefined;
    if (vscodeInstance instanceof DockerVSCodeInstance) {
      const ports = (vscodeInstance as DockerVSCodeInstance).getPorts();
      extensionPort = ports?.extension;
    }

    if (!extensionPort) {
      return { success: false, error: "Extension port not available" };
    }

    // Connect to VSCode extension socket
    const { io } = await import("socket.io-client");
    const extensionSocket = io(`http://localhost:${extensionPort}`, {
      timeout: 10000,
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        extensionSocket.disconnect();
        resolve({ success: false, error: "Timeout connecting to VSCode extension" });
      }, 15000);

      extensionSocket.on("connect", () => {
        console.log(`[CodeEvaluator] Connected to VSCode extension on port ${extensionPort}`);
        
        extensionSocket.emit("vscode:auto-commit-push", {
          branchName,
          commitMessage,
          agentName
        }, (response: any) => {
          clearTimeout(timeout);
          extensionSocket.disconnect();
          
          if (response.success) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: response.error });
          }
        });
      });

      extensionSocket.on("connect_error", (error) => {
        clearTimeout(timeout);
        extensionSocket.disconnect();
        resolve({ success: false, error: `Connection error: ${error.message}` });
      });
    });
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}