import { maskSensitive, singleQuote } from "./shell";
import type { MorphInstance } from "./git";

export interface HydrateRepoConfig {
  owner: string;
  name: string;
  repoFull: string;
  cloneUrl: string;
  maskedCloneUrl: string;
  depth: number;
  baseBranch: string;
  newBranch: string;
}

const MORPH_WORKSPACE_PATH = "/root/workspace";

export const createHydrateScript = ({
  workspacePath,
  repo,
}: {
  workspacePath: string;
  repo?: HydrateRepoConfig;
}): string => {
  const lines: string[] = [
    "set -euo pipefail",
    "",
    `WORKSPACE=${singleQuote(workspacePath)}`,
    "",
    'mkdir -p "$WORKSPACE"',
    "",
  ];

  if (repo) {
    lines.push(
      `OWNER=${singleQuote(repo.owner)}`,
      `REPO=${singleQuote(repo.name)}`,
      `REPO_FULL=${singleQuote(repo.repoFull)}`,
      `CLONE_URL=${singleQuote(repo.cloneUrl)}`,
      `MASKED_CLONE_URL=${singleQuote(repo.maskedCloneUrl)}`,
      `BASE_BRANCH=${singleQuote(repo.baseBranch)}`,
      `NEW_BRANCH=${singleQuote(repo.newBranch)}`,
      `DEPTH=${repo.depth}`,
      "",
      'REMOTE=""',
      'if [ -d "$WORKSPACE/.git" ]; then',
      '  REMOTE=$(cd "$WORKSPACE" && git remote get-url origin || echo "")',
      "fi",
      "",
      'if [ -n "$REMOTE" ] && ! printf \'%s\' "$REMOTE" | grep -q "$OWNER/$REPO"; then',
      '  echo "[sandboxes.start] remote mismatch; clearing workspace"',
      '  rm -rf "$WORKSPACE"/* "$WORKSPACE"/.[!.]* "$WORKSPACE"/..?* 2>/dev/null || true',
      "fi",
      "",
      'if [ ! -d "$WORKSPACE/.git" ]; then',
      '  echo "[sandboxes.start] Cloning $MASKED_CLONE_URL depth=$DEPTH -> $WORKSPACE"',
      '  git clone --depth $DEPTH "$CLONE_URL" "$WORKSPACE"',
      "else",
      '  echo "[sandboxes.start] Fetching updates for $REPO_FULL"',
      '  (cd "$WORKSPACE" && git fetch --all --prune || true)',
      "fi",
      "",
      "(",
      '  cd "$WORKSPACE"',
      '  (git checkout "$BASE_BRANCH" || git checkout -b "$BASE_BRANCH" "origin/$BASE_BRANCH") && git pull --ff-only || true',
      '  if [ -n "$NEW_BRANCH" ]; then',
      '    git switch -C "$NEW_BRANCH" || true',
      "  fi",
      "  ls -la | head -50",
      ")",
      ""
    );
  }

  lines.push(
    'if [ -d "$WORKSPACE" ]; then',
    '  for dir in "$WORKSPACE"/*; do',
    '    if [ -d "$dir" ]; then',
    '      if [ -d "$dir/.git" ]; then',
    '        echo "[sandboxes.start] git pull in $dir"',
    '        (cd "$dir" && git pull --ff-only || true) &',
    "      else",
    '        echo "[sandboxes.start] skipping $dir (no git repo)"',
    "      fi",
    "    fi",
    "  done",
    "  wait || true",
    "else",
    '  echo "[sandboxes.start] $WORKSPACE missing"',
    "fi"
  );

  return lines.join("\n");
};

export const hydrateWorkspace = async ({
  instance,
  repo,
}: {
  instance: MorphInstance;
  repo?: HydrateRepoConfig;
}): Promise<void> => {
  const script = createHydrateScript({
    workspacePath: MORPH_WORKSPACE_PATH,
    repo,
  });

  const hydrateRes = await instance.exec(`bash -lc ${singleQuote(script)}`);
  const maskedStdout = maskSensitive(hydrateRes.stdout || "").slice(0, 500);
  if (maskedStdout) {
    console.log(`[sandboxes.start] hydration stdout:\n${maskedStdout}`);
  }
  console.log(
    `[sandboxes.start] hydration exit=${hydrateRes.exit_code} stderr=${maskSensitive(
      hydrateRes.stderr || ""
    ).slice(0, 200)}`
  );

  if (hydrateRes.exit_code !== 0) {
    throw new Error("Hydration failed");
  }
};
