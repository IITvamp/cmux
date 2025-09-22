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

  return [
    "set -e",
    "CMUX_MSG=$(mktemp)",
    "cleanup() { rm -f \"$CMUX_MSG\"; }",
    "trap cleanup EXIT",
    `cat <<'CMUX_EOF' > "$CMUX_MSG"`,
    commitMessage,
    "CMUX_EOF",
    "",
    "run_repo() {",
    "  local repo=\"$1\"",
    "  (",
    "    cd \"$repo\"",
    "    git add -A",
    `    (git checkout -b ${b} 2>/dev/null || git checkout ${b})`,
    `    (git commit -F "$CMUX_MSG" || echo 'No changes to commit')`,
    // If remote branch exists, integrate updates before pushing
    `    (git ls-remote --heads origin ${b} | grep -q . && git pull --rebase origin ${b} || echo 'Remote branch missing; skip pull --rebase')`,
    `    git push -u origin ${b}`,
    "  )",
    "}",
    "",
    "repos=()",
    "if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then",
    "  repos+=(.)",
    "else",
    "  while IFS= read -r -d '' repo; do",
    "    if git -C \"$repo\" rev-parse --is-inside-work-tree >/dev/null 2>&1; then",
    "      repos+=(\"$repo\")",
    "    fi",
    "  done < <(find . -mindepth 1 -maxdepth 1 -type d -print0)",
    "fi",
    "",
    "if [ \"${#repos[@]}\" -eq 0 ]; then",
    "  echo 'No git repositories found for auto-commit'",
    "else",
    "  pids=()",
    "  for repo in \"${repos[@]}\"; do",
    "    run_repo \"$repo\" &",
    "    pids+=($!)",
    "  done",
    "  fail=0",
    "  for pid in \"${pids[@]}\"; do",
    "    if ! wait \"$pid\"; then",
    "      fail=1",
    "    fi",
    "  done",
    "  if [ \"$fail\" -ne 0 ]; then",
    "    exit \"$fail\"",
    "  fi",
    "fi",
  ].join("\n");
}
