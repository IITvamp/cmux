/**
 * Build a bun script to stage, commit, pull --rebase (if remote exists), and push.
 */
export function buildAutoCommitPushCommand(): string {
  return `#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";

const branchName = process.env.CMUX_BRANCH_NAME;
const commitMessage = process.env.CMUX_COMMIT_MESSAGE;
if (!branchName || !commitMessage) {
  console.error('[cmux auto-commit] missing branch name or commit message');
  console.error('[cmux auto-commit] branch name:', branchName);
  console.error('[cmux auto-commit] commit message:', commitMessage);
  process.exit(1);
}

async function runRepo(repoPath: string) {
  console.error(\`[cmux auto-commit] repo=\${repoPath} -> enter directory\`);

  try {
    // Get repo info
    const origin = await $\`git -C \${repoPath} config --get remote.origin.url\`.text().catch(() => '');
    console.error(\`[cmux auto-commit] repo=\${repoPath} -> origin=\${origin.trim()}\`);

    // Check status
    console.error(\`[cmux auto-commit] repo=\${repoPath} -> git status --short\`);
    const status = await $\`git -C \${repoPath} status --short\`.text();

    // Add all changes
    console.error(\`[cmux auto-commit] repo=\${repoPath} -> git add -A\`);
    await $\`git -C \${repoPath} add -A\`;

    // Checkout branch
    console.error(\`[cmux auto-commit] repo=\${repoPath} -> checkout \${branchName}\`);
    try {
      await $\`git -C \${repoPath} checkout -b \${branchName}\`.quiet();
    } catch {
      await $\`git -C \${repoPath} checkout \${branchName}\`;
    }

    // Commit
    console.error(\`[cmux auto-commit] repo=\${repoPath} -> git commit\`);
    try {
      await $\`git -C \${repoPath} commit -m \${commitMessage}\`;
      console.error(\`[cmux auto-commit] repo=\${repoPath} commit created\`);
    } catch (e: any) {
      const hasChanges = await $\`git -C \${repoPath} status --short\`.text();
      if (hasChanges.trim()) {
        console.error(\`[cmux auto-commit] repo=\${repoPath} commit failed with pending changes\`);
        throw e;
      } else {
        console.error(\`[cmux auto-commit] repo=\${repoPath} nothing to commit\`);
      }
    }

    // Check if remote branch exists
    const remoteBranch = await $\`git -C \${repoPath} ls-remote --heads origin \${branchName}\`.text().catch(() => '');

    if (remoteBranch.trim()) {
      console.error(\`[cmux auto-commit] repo=\${repoPath} -> git pull --rebase origin \${branchName}\`);
      await $\`git -C \${repoPath} pull --rebase origin \${branchName}\`;
    } else {
      console.error(\`[cmux auto-commit] repo=\${repoPath} remote branch missing; skip pull --rebase\`);
    }

    // Push
    console.error(\`[cmux auto-commit] repo=\${repoPath} -> git push -u origin \${branchName}\`);
    await $\`git -C \${repoPath} push -u origin \${branchName}\`;

  } catch (error: any) {
    console.error(\`[cmux auto-commit] repo=\${repoPath} failed:\`, error.message);
    throw error; // Will be caught by Promise.allSettled
  }
}

async function main() {
  console.error(\`[cmux auto-commit] script start cwd=\${process.cwd()}\`);

  // Check gh auth status if available
  try {
    const ghExists = await $\`command -v gh\`.quiet();
    if (ghExists.exitCode === 0) {
      console.error('[cmux auto-commit] gh auth status:');
      await $\`gh auth status\`.nothrow();
    }
  } catch {}

  console.error('[cmux auto-commit] detecting repositories');

  // Always scan from /root/workspace regardless of current directory
  const workspaceDir = '/root/workspace';
  console.error(\`[cmux auto-commit] scanning repos from \${workspaceDir}\`);

  const repoPaths: string[] = [];

  if (existsSync(workspaceDir)) {
    const repos = await $\`ls -d \${workspaceDir}/*/\`.text().catch(() => '');

    for (const repoDir of repos.trim().split('\\n').filter(Boolean)) {
      const gitPath = join(repoDir, '.git');

      if (existsSync(gitPath)) {
        // Verify it's a git repo
        try {
          await $\`git -C \${repoDir} rev-parse --is-inside-work-tree\`.quiet();
          const fullPath = await $\`cd \${repoDir} && pwd\`.text();
          const repoPath = fullPath.trim();

          console.error(\`[cmux auto-commit] found repo: \${repoPath}\`);
          repoPaths.push(repoPath);
        } catch {
          // Not a valid git repo, skip
        }
      }
    }
  }

  if (repoPaths.length === 0) {
    console.error('[cmux auto-commit] No git repositories found for auto-commit');
  } else {
    console.error(\`[cmux auto-commit] processing \${repoPaths.length} repos in parallel\`);

    // Process all repos in parallel
    const results = await Promise.allSettled(
      repoPaths.map(repoPath => runRepo(repoPath))
    );

    // Report results
    let successCount = 0;
    let failCount = 0;

    results.forEach((result, index) => {
      const repoPath = repoPaths[index];
      if (result.status === 'fulfilled') {
        successCount++;
        console.error(\`[cmux auto-commit] ✓ \${repoPath} succeeded\`);
      } else {
        failCount++;
        console.error(\`[cmux auto-commit] ✗ \${repoPath} failed: \${result.reason}\`);
      }
    });

    console.error(\`[cmux auto-commit] completed: \${successCount} succeeded, \${failCount} failed\`);

    // Exit with error if any repos failed
    if (failCount > 0) {
      process.exit(1);
    }
  }
}

await main().catch((error) => {
  console.error('[cmux auto-commit] Fatal error:', error);
  process.exit(1);
});
`;
}
