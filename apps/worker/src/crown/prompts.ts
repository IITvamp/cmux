
export function buildPullRequestTitle(prompt: string): string {
  const base = prompt.trim() || "cmux changes";
  const title = `[Crown] ${base}`;
  return title.length > 72 ? `${title.slice(0, 69)}...` : title;
}

export function buildPullRequestBody({
  summary,
  prompt,
  agentName,
  branch,
  taskId,
  runId,
}: {
  summary?: string;
  prompt: string;
  agentName: string;
  branch: string;
  taskId: string;
  runId: string;
}): string {
  const bodySummary = summary?.trim() || "Summary not available.";
  return `## 🏆 Crown Winner: ${agentName}

### Task Description
${prompt}

### Summary
${bodySummary}

### Implementation Details
- **Agent**: ${agentName}
- **Task ID**: ${taskId}
- **Run ID**: ${runId}
- **Branch**: ${branch}
- **Created**: ${new Date().toISOString()}`;
}
