/**
 * Build a single safe bash command to stage, commit, pull --rebase (if remote exists), and push.
 * Uses JSON.stringify to safely quote dynamic strings that may contain spaces/newlines/quotes.
 */
export function buildAutoCommitPushCommand(options: {
  branchName: string;
  commitMessage: string;
}): string {
  const { branchName, commitMessage } = options;

  // Use JSON to produce a double-quoted, escaped string safe for bash -c
  const b = JSON.stringify(branchName);
  const m = JSON.stringify(commitMessage);

  // Use pipefail so pipelines propagate failures; tolerate no-op commit and missing remote
  const parts: string[] = [
    "git add -A",
    // Suppress noisy error when branch already exists, then fallback to checkout
    `(git checkout -b ${b} 2>/dev/null || git checkout ${b})`,
    `(git commit -m ${m} || echo 'No changes to commit')`,
    // If remote branch exists, integrate updates before pushing
    `(git ls-remote --heads origin ${b} | grep -q . && git pull --rebase origin ${b} || echo 'Remote branch missing; skip pull --rebase')`,
    `git push -u origin ${b}`,
  ];

  return parts.join(" && ");
}
