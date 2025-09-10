import type { Id } from "@cmux/convex/dataModel";
import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";
import { StackAdminApp } from "@stackframe/js";
import { getRunDiffs } from "../diffs/getRunDiffs.js";
import { GitDiffManager } from "../gitDiff.js";
import { runWithAuthToken } from "../utils/requestContext.js";

type CliArgs = {
  run?: string;
  team: string;
  user?: string;
  includeContents: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { team: "default", includeContents: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--run" || a === "-r") out.run = argv[++i];
    else if (a === "--team" || a === "-t") out.team = argv[++i] ?? out.team;
    else if (a === "--user" || a === "-u") out.user = argv[++i];
    else if (a === "--no-contents") out.includeContents = false;
    else if (!out.run) out.run = a; // positional run id
  }
  return out;
}

async function mintStackAccessToken(userId: string): Promise<string> {
  const {
    NEXT_PUBLIC_STACK_PROJECT_ID,
    NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
    STACK_SECRET_SERVER_KEY,
    STACK_SUPER_SECRET_ADMIN_KEY,
  } = process.env as Record<string, string | undefined>;

  const admin = new StackAdminApp({
    tokenStore: "memory",
    projectId: NEXT_PUBLIC_STACK_PROJECT_ID,
    publishableClientKey: NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
    secretServerKey: STACK_SECRET_SERVER_KEY,
    superSecretAdminKey: STACK_SUPER_SECRET_ADMIN_KEY,
  });

  const user = await admin.getUser(userId);
  if (!user) throw new Error("User not found");
  const session = await user.createSession({ expiresInMillis: 10 * 60 * 1000 });
  const tokens = await session.getTokens();
  const token = tokens.accessToken;
  if (!token) throw new Error("No access token returned");
  return token;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args.run) {
    console.error(
      "Usage: bun run apps/server/src/scripts/get-run-diffs.ts --run <taskRunId> [--team <slug>] [--user <uuid>] [--no-contents]"
    );
    process.exit(1);
  }

  // Default test user used elsewhere in the repo
  const defaultTestUser = "487b5ddc-0da0-4f12-8834-f452863a83f5";
  const userId = args.user || process.env.CMUX_TEST_USER_ID || defaultTestUser;

  const accessToken = await mintStackAccessToken(userId);

  const gitDiffManager = new GitDiffManager();
  const start = Date.now();

  const diffs = await runWithAuthToken(accessToken, async () => {
    return await getRunDiffs({
      taskRunId: args.run as Id<"taskRuns">,
      teamSlugOrId: args.team,
      gitDiffManager,
      includeContents: args.includeContents,
    });
  });

  const elapsed = Date.now() - start;
  const output = {
    runId: args.run,
    team: args.team,
    userId,
    count: (diffs as ReplaceDiffEntry[]).length,
    elapsedMs: elapsed,
    diffs,
  };
  console.log(JSON.stringify(output, null, 2));
}

void main();

