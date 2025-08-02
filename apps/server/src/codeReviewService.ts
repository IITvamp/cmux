import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { codeReviewResponseSchema, type CodeReviewRequest } from "@cmux/shared";
import { api } from "@cmux/convex/api";
import type { Doc, Id } from "@cmux/convex/dataModel";
import { convex } from "./utils/convexClient.js";

export class CodeReviewService {
  private openai: ReturnType<typeof createOpenAI>;

  constructor() {
    const openaiApiKey = process.env.OPENAI_API_KEY || "";
    if (!openaiApiKey) {
      console.warn("OPENAI_API_KEY not set. Code review features will be disabled.");
    }
    
    this.openai = createOpenAI({
      apiKey: openaiApiKey,
    });
  }

  async evaluateTaskRuns(taskId: string) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    // Get task and all completed task runs
    const task = await convex.query(api.tasks.getById, { id: taskId as Id<"tasks"> });
    if (!task) {
      throw new Error("Task not found");
    }

    const taskRuns = await convex.query(api.taskRuns.listByTaskId, { taskId: taskId as Id<"tasks"> });
    const completedRuns = taskRuns.filter(run => run.status === "completed");

    if (completedRuns.length === 0) {
      throw new Error("No completed task runs to evaluate");
    }

    // Create code review record
    // TODO: Uncomment when Convex is running and codeReviews API is generated
    // const codeReviewId = await convex.mutation(api.codeReviews.create, {
    //   taskId: taskId as Id<"tasks">,
    //   reviewModel: "gpt-4-turbo",
    //   reviewPrompt: this.createReviewPrompt(task.description || task.text),
    // });
    const codeReviewId = `temp-${Date.now()}` as any;

    try {
      // Get diffs for each completed run
      const agentOutputs = await Promise.all(
        completedRuns.map(async (run) => {
          const diff = await this.getTaskRunDiff(run._id);
          // Extract agent name from the prompt which includes it in the format
          const agentNameMatch = run.prompt.match(/Agent: ([^\n]+)/);
          const agentName = agentNameMatch ? agentNameMatch[1] : "Unknown Agent";
          
          return {
            taskRunId: run._id,
            agentName,
            diff,
            terminalLog: run.log,
          };
        })
      );

      // Prepare the review request
      const reviewRequest: CodeReviewRequest = {
        taskDescription: task.description || task.text,
        agentOutputs: agentOutputs.map(output => ({
          agentName: output.agentName,
          diff: output.diff,
          terminalLog: output.terminalLog,
        })),
      };

      // Call OpenAI to evaluate the outputs
      const { object: reviewResponse } = await generateObject({
        model: this.openai("gpt-4-turbo"),
        schema: codeReviewResponseSchema,
        prompt: this.createReviewPrompt(reviewRequest.taskDescription),
        messages: [
          {
            role: "system",
            content: `You are an expert code reviewer. Evaluate the following code outputs from different AI agents and determine which one best solves the given task. Consider code quality, adherence to requirements, test coverage, performance, and security.`,
          },
          {
            role: "user",
            content: JSON.stringify(reviewRequest),
          },
        ],
      });

      // Find the winning task run
      const winner = agentOutputs.find(
        output => output.agentName === reviewResponse.winner.agentName
      );

      if (!winner) {
        throw new Error("Winner not found in task runs");
      }

      // Update the code review with results
      const taskRunEvaluations = agentOutputs.map(output => {
        const evaluation = reviewResponse.evaluations.find(
          (e: any) => e.agentName === output.agentName
        );
        
        return {
          taskRunId: output.taskRunId as Id<"taskRuns">,
          agentName: output.agentName,
          diff: output.diff,
          evaluation: evaluation?.evaluation || {
            score: 0,
            codeQuality: 0,
            adherenceToRequirements: 0,
            testCoverage: 0,
            performance: 0,
            security: 0,
            reasoning: "Evaluation not found",
          },
        };
      });

      // TODO: Uncomment when Convex is running and codeReviews API is generated
      // await convex.mutation(api.codeReviews.update, {
      //   codeReviewId,
      //   taskRuns: taskRunEvaluations,
      //   winnerId: winner.taskRunId as Id<"taskRuns">,
      //   status: "completed",
      // });

      // Mark the winning task run as crowned
      await convex.mutation(api.taskRuns.updateCrownStatus, {
        taskRunId: winner.taskRunId as Id<"taskRuns">,
        isCrowned: true,
        codeReviewId,
      });

      // Create PR for the crowned solution
      await this.createPullRequestForWinner(winner.taskRunId, task, reviewResponse.winner.reasoning);

      return {
        codeReviewId,
        winnerId: winner.taskRunId as Id<"taskRuns">,
        winnerAgentName: winner.agentName,
        reviewResponse,
      };
    } catch (error) {
      // Update review status to failed
      // TODO: Uncomment when Convex is running and codeReviews API is generated
      // await convex.mutation(api.codeReviews.update, {
      //   codeReviewId,
      //   status: "failed",
      // });
      throw error;
    }
  }

  private createReviewPrompt(taskDescription: string): string {
    return `Task: ${taskDescription}

Please evaluate each agent's code output based on:
1. Code Quality (readability, maintainability, best practices)
2. Adherence to Requirements (how well it solves the given task)
3. Test Coverage (if tests were requested or are beneficial)
4. Performance (efficiency and optimization)
5. Security (no vulnerabilities or exposed secrets)

Provide a score from 0-100 for each criterion and an overall score.
Also explain your reasoning for each evaluation and why you chose the winner.`;
  }

  private extractAgentName(prompt: string): string {
    // Extract agent name from the prompt which includes it in the format "Agent: <name>"
    const agentNameMatch = prompt.match(/Agent: ([^\n]+)/);
    return agentNameMatch ? agentNameMatch[1] : "Unknown Agent";
  }

  private async getTaskRunDiff(taskRunId: string): Promise<string> {
    // Get the git diff for a specific task run
    // This will be implemented by calling the git diff endpoint
    const response = await fetch(`http://localhost:9776/api/taskRuns/${taskRunId}/diff`);
    if (!response.ok) {
      throw new Error(`Failed to get diff for task run ${taskRunId}`);
    }
    return response.text();
  }

  private async createPullRequestForWinner(
    taskRunId: string,
    task: Doc<"tasks">,
    winnerReasoning: string
  ): Promise<void> {
    try {
      const taskRun = await convex.query(api.taskRuns.get, { id: taskRunId as Id<"taskRuns"> });
      if (!taskRun || !taskRun.worktreePath) {
        throw new Error("Task run or worktree not found");
      }

      // Get the branch name from the worktree
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);

      // Get current branch name
      const { stdout: branchName } = await execAsync(
        "git rev-parse --abbrev-ref HEAD",
        { cwd: taskRun.worktreePath }
      );

      const branch = branchName.trim();
      
      // Check if we're already on a feature branch
      if (branch === "main" || branch === "master") {
        console.warn("Task run is on main branch, skipping PR creation");
        return;
      }

      // Create PR using GitHub CLI
      const prTitle = `🏆 ${task.text || "Task completion"}`;
      const prBody = `## Summary
This solution was crowned as the best implementation after automated code review.

### Task Description
${task.description || task.text}

### Why This Solution Won
${winnerReasoning}

### Implementation Details
- **Agent**: ${this.extractAgentName(taskRun.prompt)}
- **Task Run ID**: ${taskRunId}
- **Completed**: ${new Date(taskRun.completedAt || Date.now()).toISOString()}

---
🤖 Generated with [cmux](https://github.com/manaflow-ai/cmux)
`;

      // Create the PR
      const { stdout: prUrl } = await execAsync(
        `gh pr create --title "${prTitle}" --body "${prBody}" --head "${branch}" || echo "PR already exists"`,
        { cwd: taskRun.worktreePath }
      );

      console.log(`Created PR: ${prUrl.trim()}`);
    } catch (error) {
      console.error("Failed to create PR for winner:", error);
      // Don't throw - PR creation is not critical
    }
  }
}