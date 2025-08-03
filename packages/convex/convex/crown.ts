import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

export const evaluateAndCrownWinner = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    // Get all completed runs for this task
    const taskRuns = await ctx.db
      .query("taskRuns")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // If only one model or less, crown it by default
    if (taskRuns.length <= 1) {
      if (taskRuns.length === 1) {
        await ctx.db.patch(taskRuns[0]._id, {
          isCrowned: true,
          crownReason: "Only one model completed the task",
        });
      }
      return taskRuns[0]?._id || null;
    }

    // Only evaluate if 2+ models completed
    if (taskRuns.length < 2) {
      return null;
    }

    // Prepare evaluation data
    const candidateData = await Promise.all(
      taskRuns.map(async (run) => {
        // Extract agent name from prompt
        const agentMatch = run.prompt.match(/Using agent: ([\w\/\-\.]+)/);
        const agentName = agentMatch ? agentMatch[1] : "Unknown";

        // Get git diff for this run
        const gitDiff = await getGitDiffForRun(run);

        return {
          runId: run._id,
          agentName,
          log: run.log.slice(-5000), // Last 5000 chars of log
          exitCode: run.exitCode,
          completedAt: run.completedAt,
          gitDiff,
        };
      })
    );

    // Create evaluation prompt
    const evaluationPrompt = `You are evaluating code implementations from multiple AI coding assistants for the following task:

Task: ${task.text}
${task.description ? `Description: ${task.description}` : ""}

Here are the implementations from each model:

${candidateData
  .map(
    (candidate, idx) => `
### Model ${idx + 1}: ${candidate.agentName}
Exit Code: ${candidate.exitCode}
Completion Time: ${candidate.completedAt}

Git Diff:
\`\`\`diff
${candidate.gitDiff || "No changes detected"}
\`\`\`

Recent Log Output:
\`\`\`
${candidate.log}
\`\`\`
`
  )
  .join("\n---\n")}

Please evaluate these implementations and select the BEST one based on:
1. Code quality and best practices
2. Completeness of the solution
3. Error handling and robustness
4. Performance considerations
5. Clean git diff (no unnecessary changes)
6. Successfully completed without errors

Respond with a JSON object in this format:
{
  "winnerIndex": <0-based index of the winning model>,
  "reason": "<detailed explanation of why this implementation is the best>"
}`;

    // Call LLM for evaluation (using Claude via the existing API key)
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_envVar", (q) => q.eq("envVar", "ANTHROPIC_API_KEY"))
      .first();

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not found in settings");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.value,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: evaluationPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.content[0].text;

    // Parse the response
    let evaluation;
    try {
      evaluation = JSON.parse(content);
    } catch (e) {
      // Fallback: try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse LLM evaluation response");
      }
    }

    const winnerIndex = evaluation.winnerIndex;
    const winnerRunId = candidateData[winnerIndex].runId;

    // Save evaluation record
    await ctx.db.insert("crownEvaluations", {
      taskId: args.taskId,
      evaluatedAt: Date.now(),
      winnerRunId,
      candidateRunIds: candidateData.map((c) => c.runId),
      evaluationPrompt,
      evaluationResponse: content,
      createdAt: Date.now(),
    });

    // Update the winning run
    await ctx.db.patch(winnerRunId, {
      isCrowned: true,
      crownReason: evaluation.reason,
    });

    // Update other runs to ensure they're not crowned
    for (const candidate of candidateData) {
      if (candidate.runId !== winnerRunId) {
        await ctx.db.patch(candidate.runId, {
          isCrowned: false,
        });
      }
    }

    // Mark that PR creation is needed
    // The server will handle actual PR creation since it requires git operations

    return winnerRunId;
  },
});

// Helper function to get git diff for a run
async function getGitDiffForRun(run: Doc<"taskRuns">): Promise<string> {
  // This would need to be implemented based on how diffs are stored
  // For now, we'll extract from the log if available
  const diffMatch = run.log.match(/diff --git[\s\S]*?(?=\n\n|\n[A-Z]|$)/);
  return diffMatch ? diffMatch[0].slice(0, 3000) : "";
}

export const getCrownedRun = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const crownedRun = await ctx.db
      .query("taskRuns")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .filter((q) => q.eq(q.field("isCrowned"), true))
      .first();

    return crownedRun;
  },
});

export const getCrownEvaluation = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const evaluation = await ctx.db
      .query("crownEvaluations")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .first();

    return evaluation;
  },
});

