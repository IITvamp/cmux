import { log } from "../logger";
import { execAsync, WORKSPACE_ROOT } from "./utils";
import type {
  CandidateData,
  CrownWorkerCheckResponse,
  PullRequestMetadata,
  WorkerRunContext,
} from "./types";
import {
  buildPullRequestBody,
  buildPullRequestTitle,
} from "./prompts";

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

type GhPrCreateResponse = {
  url?: string;
  number?: number | string;
  state?: string;
  isDraft?: boolean;
};

function parseGhPrCreateResponse(input: unknown): GhPrCreateResponse | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const candidate = input as GhPrCreateResponse;
  if (typeof candidate.url !== "string") {
    return null;
  }
  return candidate;
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

    const parsed = parseGhPrCreateResponse(JSON.parse(trimmed));
    if (!parsed) {
      log("ERROR", "Failed to parse gh pr create output", {
        stdout: trimmed,
      });
      return null;
    }

    const prUrl = parsed.url;
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
