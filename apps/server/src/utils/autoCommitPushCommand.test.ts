import { describe, expect, it } from "vitest";
import { buildAutoCommitPushCommand } from "./autoCommitPushCommand";

describe("buildAutoCommitPushCommand", () => {
  it("builds a single command with safe quoting and heredoc", () => {
    const branch = "feat/new-branch";
    const message = 'Fix bugs\nAdd features "quoted" and $pecial chars';
    const cmd = buildAutoCommitPushCommand({
      branchName: branch,
      commitMessage: message,
    });

    expect(cmd.startsWith("set -euo pipefail\n")).toBe(true);
    expect(cmd).toContain("script start cwd=$(pwd)");
    expect(cmd).toContain("gh auth status");
    expect(cmd).toContain("error line $LINENO exit=$?");

    // Branch names are JSON-quoted where used in commands
    expect(cmd).toContain(`git checkout -b ${JSON.stringify(branch)}`);
    expect(cmd).toContain(`git checkout ${JSON.stringify(branch)}`);
    // Uses heredoc to write commit message and -F to preserve newlines
    expect(cmd).toContain(`cat <<'CMUX_EOF' > "$CMUX_MSG"`);
    expect(cmd).toContain(`git -C "$repo" commit -F "$CMUX_MSG"`);
    // Commit body appears verbatim in the script
    expect(cmd).toContain(message);

    // Remote detection and pull --rebase logic are present
    expect(cmd).toContain(
      `if git -C "$repo" ls-remote --heads origin ${JSON.stringify(branch)} | grep -q .; then`
    );
    expect(cmd).toContain(
      `git -C "$repo" pull --rebase origin ${JSON.stringify(branch)}`
    );
    expect(cmd).toContain(
      `repo=$repo remote branch missing; skip pull --rebase`
    );

    // Push with upstream
    expect(cmd).toContain(
      `git -C "$repo" push -u origin ${JSON.stringify(branch)}`
    );

    // Script contains newlines for heredoc
    expect(cmd.includes("\n")).toBe(true);

    // Script supports running against current repo and nested repos in parallel
    expect(cmd).toContain("repos+=(.)");
    expect(cmd).not.toContain("is_repo_seen()");
    expect(cmd).toMatch(
      /find \. -mindepth 1 -maxdepth 6 .* -name \.git -print0/
    );
    expect(cmd).toContain('run_repo "$repo"');
    expect(cmd).toContain("scanning repos from $(pwd)");
    expect(cmd).toContain("repo=$repo -> enter directory");
    expect(cmd).toContain("repo=$repo -> pwd=$repo_path");
    expect(cmd).toContain("repo=$repo -> origin=$origin_url");
    expect(cmd).toContain('git -C "$repo" status --short');
    expect(cmd).toContain("detecting repositories");
    expect(cmd).toContain("scanning repos from $(pwd)");
    expect(cmd).toContain("filtered_repos=()");
    expect(cmd).toContain('repos=("${filtered_repos[@]-}")');
    expect(cmd).toContain("trap - ERR");
    expect(cmd).toContain(
      "trap 'echo \"[cmux auto-commit] error line $LINENO exit=$?\" >&2' ERR"
    );
    expect(cmd).toContain("[cmux auto-commit] discovered ${#repos[@]} repos");
    expect(cmd).toContain("repo candidate: $repo");
    expect(cmd).not.toContain('wait "$pid"');
  });

  it("handles odd characters by leaving quoting to JSON", () => {
    const branch = "weird\nbranch name '$(rm -rf /)'";
    const message = `multi-line\nmessage with 'quotes' and \n newlines`;
    const cmd = buildAutoCommitPushCommand({
      branchName: branch,
      commitMessage: message,
    });

    // Ensure the JSON-quoted branch appears, and raw message is present
    expect(cmd).toContain(JSON.stringify(branch));
    expect(cmd).toContain(message);
  });
});
