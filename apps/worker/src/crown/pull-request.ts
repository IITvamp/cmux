import { log } from "../logger";
import { WORKSPACE_ROOT } from "./constants";
import type {
  CandidateData,
  CrownWorkerCheckResponse,
  PullRequestMetadata,
  WorkerRunContext,
} from "./types";
import { execAsync } from "./shell";

function buildPullRequestTitle(taskText: string): string {
  const base = taskText.trim() || "cmux changes";
  const title = `[Crown] ${base}`;
  return title.length > 72 ? `${title.slice(0, 69)}...` : title;
}

function buildPullRequestBody({
  summary,
  taskText,
  agentName,
  branch,
  taskId,
  runId,
}: {
  summary?: string;
  taskText: string;
  agentName: string;
  branch: string;
  taskId: string;
  runId: string;
}): string {
  const bodySummary = summary?.trim() || "Summary not available.";
  return `## 🏆 Crown Winner: ${agentName}

### Task Description
${taskText}

### Summary
${bodySummary}

### Implementation Details
- **Agent**: ${agentName}
- **Task ID**: ${taskId}
- **Run ID**: ${runId}
- **Branch**: ${branch}
- **Created**: ${new Date().toISOString()}`;
}

function mapGhState(
  state: string | undefined
): "none" | "draft" | "open" | "merged" | "closed" | "unknown" {
  if (!state) return "unknown";
  const normalized = state.toLowerCase();
  if (
    normalized === "open" ||
    normalized === "closed" ||
    normalized === "merged"
  ) {
    return normalized;
  }
  return "unknown";
}

export async function createPullRequestIfEnabled(options: {
  check: CrownWorkerCheckResponse;
  winner: CandidateData;
  summary?: string;
  context: WorkerRunContext;
}): Promise<PullRequestMetadata | null> {
  const { check, winner, summary, context } = options;
  if (!check.task.autoPrEnabled) {
    return null;
  }

  const branch = winner.newBranch;
  if (!branch) {
    log("WARNING", "Skipping PR creation - winner branch missing", {
      taskId: check.taskId,
      runId: winner.runId,
    });
    return null;
  }

  const baseBranch = check.task.baseBranch || "main";
  const prTitle = buildPullRequestTitle(check.task.text);
  const prBody = buildPullRequestBody({
    summary,
    taskText: check.task.text,
    agentName: winner.agentName,
    branch,
    taskId: context.taskId ?? check.taskId,
    runId: winner.runId,
  });

  const script = `set -e
BODY_FILE=$(mktemp /tmp/cmux-pr-XXXXXX.md)
cat <<'CMUX_EOF' > "$BODY_FILE"
${prBody}
CMUX_EOF
gh pr create --base "$PR_BASE" --head "$PR_HEAD" --title "$PR_TITLE" --body-file "$BODY_FILE" --json url,number,state,isDraft
rm -f "$BODY_FILE"
`;

  try {
    const { stdout } = await execAsync(script, {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
        PR_TITLE: prTitle,
        PR_BASE: baseBranch,
        PR_HEAD: branch,
      },
      maxBuffer: 5 * 1024 * 1024,
    });

    const trimmed = stdout.trim();
    if (!trimmed) {
      log("ERROR", "gh pr create returned empty output", {
        taskId: check.taskId,
        runId: winner.runId,
      });
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      log("ERROR", "Failed to parse gh pr create output", {
        stdout: trimmed,
        error,
      });
      return null;
    }

    const prUrl = typeof parsed.url === "string" ? parsed.url : undefined;
    if (!prUrl) {
      log("ERROR", "gh pr create response missing URL", { parsed });
      return null;
    }

    const prNumber = (() => {
      if (typeof parsed.number === "number") return parsed.number;
      if (typeof parsed.number === "string") {
        const numeric = Number(parsed.number);
        return Number.isFinite(numeric) ? numeric : undefined;
      }
      return undefined;
    })();

    const metadata: PullRequestMetadata = {
      pullRequest: {
        url: prUrl,
        number: prNumber,
        state: mapGhState(parsed.state),
        isDraft:
          typeof parsed.isDraft === "boolean" ? parsed.isDraft : undefined,
      },
      title: prTitle,
      description: prBody,
    };

    log("INFO", "Created pull request", {
      taskId: check.taskId,
      runId: winner.runId,
      url: prUrl,
    });

    return metadata;
  } catch (error) {
    log("ERROR", "Failed to create pull request", {
      taskId: check.taskId,
      runId: winner.runId,
      error,
    });
    return null;
  }
}
