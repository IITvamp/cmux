import { serverLogger } from "./utils/fileLogger.js";
import { workerExec } from "./utils/workerExec.js";
import type { VSCodeInstance } from "./vscode/VSCodeInstance.js";

export async function captureGitDiff(
  vscodeInstance: VSCodeInstance
): Promise<string> {
  try {
    if (!vscodeInstance.isWorkerConnected()) {
      serverLogger.warn(
        `[AgentSpawner] Cannot capture git diff — worker not connected`
      );
      throw new Error(
        `[AgentSpawner] Cannot capture git diff — worker not connected`
      );
    }

    const workerSocket = vscodeInstance.getWorkerSocket();

    const { stdout, stderr, exitCode } = await workerExec({
      workerSocket,
      command: "/bin/bash",
      args: ["-c", "/usr/local/bin/cmux-collect-relevant-diff.sh"],
      cwd: "/root/workspace",
      env: {},
      timeout: 30000,
    });

    if (exitCode !== 0) {
      serverLogger.warn(
        `[AgentSpawner] Diff script exited with ${exitCode}. stderr: ${stderr.slice(0, 500)}`
      );
    }

    const diff = stdout?.trim() ?? "";
    serverLogger.info(
      `[AgentSpawner] Captured ${diff.length} chars of relevant diff`
    );

    return diff;
  } catch (error) {
    serverLogger.error(`[AgentSpawner] Error capturing git diff:`, error);
    throw new Error(`[AgentSpawner] Error capturing git diff`, {
      cause: error,
    });
  }
}
