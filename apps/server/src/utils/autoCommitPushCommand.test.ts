import { describe, it, expect } from "vitest";
import { buildAutoCommitPushCommand } from "./autoCommitPushCommand";

describe("buildAutoCommitPushCommand", () => {
  it("builds a single command with safe quoting and heredoc", () => {
    const branch = "feat/new-branch";
    const message = "Fix bugs\nAdd features \"quoted\" and $pecial chars";
    const cmd = buildAutoCommitPushCommand({ branchName: branch, commitMessage: message });

    // Begins with add/checkout/prepare temp file
    expect(cmd.startsWith("git add -A && ")).toBe(true);

    // Branch names are JSON-quoted where used in commands
    expect(cmd).toContain(`git checkout -b ${JSON.stringify(branch)}`);
    expect(cmd).toContain(`git checkout ${JSON.stringify(branch)}`);
    // Uses heredoc to write commit message and -F to preserve newlines
    expect(cmd).toContain(`cat <<'CMUX_EOF' > "$CMUX_MSG"`);
    expect(cmd).toContain(`git commit -F "$CMUX_MSG"`);
    // Commit body appears verbatim in the script
    expect(cmd).toContain(message);

    // Remote detection and pull --rebase is present
    expect(cmd).toContain(
      `git ls-remote --heads origin ${JSON.stringify(branch)} | grep -q . && git pull --rebase origin ${JSON.stringify(branch)} || echo 'Remote branch missing; skip pull --rebase'`
    );

    // Push with upstream
    expect(cmd).toContain(`git push -u origin ${JSON.stringify(branch)}`);

    // Script contains newlines for heredoc
    expect(cmd.includes("\n")).toBe(true);
  });

  it("handles odd characters by leaving quoting to JSON", () => {
    const branch = "weird\nbranch name '$(rm -rf /)'";
    const message = `multi-line\nmessage with 'quotes' and \n newlines`;
    const cmd = buildAutoCommitPushCommand({ branchName: branch, commitMessage: message });

    // Ensure the JSON-quoted branch appears, and raw message is present
    expect(cmd).toContain(JSON.stringify(branch));
    expect(cmd).toContain(message);
  });
});
