import { describe, it, expect } from "vitest";
import { runWorkerExec } from "./execRunner";

describe("runWorkerExec", () => {
  it("executes bash -c with heredoc without premature expansion", async () => {
    const script = [
      "TMP=$(mktemp)",
      "cat <<'EOF' > \"$TMP\"",
      "$HOME",
      "EOF",
      "cat \"$TMP\"",
      "rm -f \"$TMP\"",
    ].join("\n");

    const res = await runWorkerExec({
      command: "bash",
      args: ["-c", script],
    });

    expect(res.exitCode).toBe(0);
    // Because of single-quoted heredoc delimiter, literal $HOME should be preserved
    expect(res.stdout.trim()).toBe("$HOME");
  });

  it("executes sh -c with heredoc without premature expansion", async () => {
    const script = [
      "TMP=$(mktemp)",
      "cat <<'EOF' > \"$TMP\"",
      "$HOME",
      "EOF",
      "cat \"$TMP\"",
      "rm -f \"$TMP\"",
    ].join("\n");

    const res = await runWorkerExec({
      command: "sh",
      args: ["-c", script],
    });

    expect(res.exitCode).toBe(0);
    expect(res.stdout.trim()).toBe("$HOME");
  });

  it("executes a tmux new-session when tmux is available", async () => {
    // Check if tmux is available
    const check = await runWorkerExec({ command: "tmux", args: ["-V"] });
    if (check.exitCode !== 0) {
      // tmux not installed in this environment; treat as graceful skip
      return;
    }

    const session = `cmux_test_${Math.random().toString(36).slice(2)}`;

    // Start a detached session that exits quickly
    const start = await runWorkerExec({
      command: "tmux",
      args: ["new-session", "-d", "-s", session, "sleep 2"],
    });
    expect(start.exitCode).toBe(0);

    // Verify the session exists
    const has = await runWorkerExec({
      command: "tmux",
      args: ["has-session", "-t", session],
    });
    expect(has.exitCode).toBe(0);

    // Kill the session
    const kill = await runWorkerExec({
      command: "tmux",
      args: ["kill-session", "-t", session],
    });
    expect(kill.exitCode).toBe(0);
  });
});
