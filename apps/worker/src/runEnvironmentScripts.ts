import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";

import type { Id } from "@cmux/convex/dataModel";
import type { WorkerTmuxScripts } from "@cmux/shared";

import { log } from "./logger";
import { waitForTmuxSession } from "./detectTerminalIdle";

const WORKSPACE_ROOT = "/root/workspace";
const CMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";
const LOG_DIR = "/var/log/cmux";

const DEV_WINDOW_NAME = "cmux-dev";
const MAINTENANCE_WINDOW_NAME = "cmux-maintenance";

const DEV_LOG_FILE = join(LOG_DIR, "dev-script.log");
const DEV_PID_FILE = join(LOG_DIR, "dev-script.pid");

const MAINTENANCE_LOG_FILE = join(LOG_DIR, "maintenance-script.log");
const MAINTENANCE_STATUS_FILE = join(LOG_DIR, "maintenance-script.status");

const DEFAULT_STATUS_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const maskSensitive = (value: string): string =>
  value.replace(/:[^@]*@/g, ":***@");

const previewOutput = (
  value: string | null | undefined,
  maxLength = 2500,
): string | null => {
  if (!value) return null;
  const trimmed = maskSensitive(value).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
};

const runTmuxCommand = async (
  args: string[],
  options: { ignoreFailure?: boolean } = {},
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn("tmux", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("exit", (code) => {
      if (code === 0 || options.ignoreFailure) {
        resolve();
        return;
      }
      const error = new Error(
        `tmux ${args.join(" ")} exited with code ${code}${
          stderr.trim().length > 0 ? `: ${stderr.trim()}` : ""
        }`,
      );
      reject(error);
    });

    child.on("error", (error) => {
      if (options.ignoreFailure) {
        resolve();
        return;
      }
      reject(error);
    });
  });

const killWindowIfExists = async (
  sessionName: string,
  windowName: string,
): Promise<void> => {
  await runTmuxCommand(
    ["kill-window", "-t", `${sessionName}:${windowName}`],
    { ignoreFailure: true },
  );
};

const writeExecutableScript = async (
  baseName: string,
  contents: string,
): Promise<string> => {
  await fs.mkdir(CMUX_RUNTIME_DIR, { recursive: true });
  const fileName = `${baseName}-${randomUUID().replace(/-/g, "")}.sh`;
  const scriptPath = join(CMUX_RUNTIME_DIR, fileName);
  await fs.writeFile(scriptPath, contents, { mode: 0o700 });
  await fs.chmod(scriptPath, 0o700);
  return scriptPath;
};

const removeFileIfExists = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
};

const readTail = async (
  filePath: string,
  maxBytes = 4000,
): Promise<string | null> => {
  try {
    const handle = await fs.open(filePath, fsConstants.O_RDONLY);
    try {
      const stats = await handle.stat();
      const length = Math.min(stats.size, maxBytes);
      const buffer = Buffer.alloc(length);
      const offset = Math.max(stats.size - length, 0);
      await handle.read(buffer, 0, length, offset);
      return buffer.toString("utf8");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const stopProcessFromPidFile = async (pidFile: string): Promise<void> => {
  try {
    const rawPid = await fs.readFile(pidFile, "utf8");
    const pid = Number.parseInt(rawPid.trim(), 10);
    if (Number.isNaN(pid)) {
      await removeFileIfExists(pidFile);
      return;
    }

    try {
      process.kill(pid, "SIGTERM");
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ESRCH") {
        await removeFileIfExists(pidFile);
        return;
      }
      throw error;
    }

    await delay(200);

    try {
      process.kill(pid, 0);
      throw new Error(`Process ${pid} still running after SIGTERM`);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ESRCH") {
        await removeFileIfExists(pidFile);
        return;
      }
      throw error;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
};

const waitForPid = async (
  pidFile: string,
  attempts = 10,
  delayMs = 300,
): Promise<number | null> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const rawPid = await fs.readFile(pidFile, "utf8");
      const pid = Number.parseInt(rawPid.trim(), 10);
      if (!Number.isNaN(pid)) {
        try {
          process.kill(pid, 0);
          return pid;
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          if (err.code !== "ESRCH") {
            throw error;
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    await delay(delayMs);
  }
  return null;
};

const waitForStatusFile = async (
  statusFile: string,
  timeoutMs = DEFAULT_STATUS_TIMEOUT_MS,
): Promise<number | null> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const contents = await fs.readFile(statusFile, "utf8");
      const trimmed = contents.trim();
      if (trimmed.length > 0) {
        const status = Number.parseInt(trimmed, 10);
        if (!Number.isNaN(status)) {
          return status;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    await delay(500);
  }
  return null;
};

const startMaintenanceScriptInTmux = async (
  sessionName: string,
  script: string,
): Promise<{ error?: string }> => {
  await fs.mkdir(LOG_DIR, { recursive: true });
  const scriptPath = await writeExecutableScript("maintenance-script", script);

  await removeFileIfExists(MAINTENANCE_STATUS_FILE);
  await killWindowIfExists(sessionName, MAINTENANCE_WINDOW_NAME);

  const command = `set -euo pipefail
trap 'status=$?; echo $status > ${MAINTENANCE_STATUS_FILE}; rm -f ${scriptPath}' EXIT
mkdir -p ${LOG_DIR}
cd ${WORKSPACE_ROOT}
: > ${MAINTENANCE_LOG_FILE}
bash -eu -o pipefail ${scriptPath} 2>&1 | tee ${MAINTENANCE_LOG_FILE}`;

  await runTmuxCommand([
    "new-window",
    "-d",
    "-t",
    sessionName,
    "-n",
    MAINTENANCE_WINDOW_NAME,
    "bash",
    "-lc",
    command,
  ]);

  const status = await waitForStatusFile(MAINTENANCE_STATUS_FILE);
  await removeFileIfExists(MAINTENANCE_STATUS_FILE);

  if (status === null) {
    return {
      error: "Maintenance script did not complete within the expected time window",
    };
  }

  if (status !== 0) {
    const logPreview = previewOutput(await readTail(MAINTENANCE_LOG_FILE));
    const parts = [`Maintenance script failed with exit code ${status}`];
    if (logPreview) {
      parts.push(`log: ${logPreview}`);
    }
    return { error: parts.join(" | ") };
  }

  return {};
};

const startDevScriptInTmux = async (
  sessionName: string,
  script: string,
): Promise<{ error?: string }> => {
  await fs.mkdir(LOG_DIR, { recursive: true });

  try {
    await stopProcessFromPidFile(DEV_PID_FILE);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Failed to stop previous dev script: ${message}` };
  }

  const scriptPath = await writeExecutableScript("dev-script", script);

  await killWindowIfExists(sessionName, DEV_WINDOW_NAME);

  const command = `set -euo pipefail
trap 'status=$?; rm -f ${DEV_PID_FILE} ${scriptPath}; exit $status' EXIT
mkdir -p ${LOG_DIR}
cd ${WORKSPACE_ROOT}
: > ${DEV_LOG_FILE}
echo $$ > ${DEV_PID_FILE}
bash -eu -o pipefail ${scriptPath} 2>&1 | tee ${DEV_LOG_FILE}`;

  await runTmuxCommand([
    "new-window",
    "-d",
    "-t",
    sessionName,
    "-n",
    DEV_WINDOW_NAME,
    "bash",
    "-lc",
    command,
  ]);

  const pid = await waitForPid(DEV_PID_FILE);
  if (!pid) {
    const logPreview = previewOutput(await readTail(DEV_LOG_FILE));
    return {
      error: logPreview
        ? `Dev script failed immediately after start | log: ${logPreview}`
        : "Dev script failed immediately after start",
    };
  }

  return {};
};

interface RunEnvironmentScriptsOptions {
  sessionName: string;
  terminalId: string;
  taskRunId?: Id<"taskRuns">;
  scripts: WorkerTmuxScripts;
  emitEnvironmentError: (errors: {
    maintenanceError?: string;
    devError?: string;
  }) => void;
}

export async function runEnvironmentScriptsInTmux(
  options: RunEnvironmentScriptsOptions,
): Promise<void> {
  const {
    sessionName,
    terminalId,
    taskRunId,
    scripts,
    emitEnvironmentError,
  } = options;

  const maintenanceScript = scripts.maintenanceScript?.trim() ?? "";
  const devScript = scripts.devScript?.trim() ?? "";

  if (maintenanceScript.length === 0 && devScript.length === 0) {
    return;
  }

  try {
    await waitForTmuxSession(sessionName, 20, 250);
  } catch (error) {
    log("ERROR", "Failed to detect tmux session before running scripts", {
      sessionName,
      error,
      terminalId,
    });
    return;
  }

  const state: { maintenanceError?: string; devError?: string } = {
    maintenanceError: undefined,
    devError: undefined,
  };

  const publish = () => {
    if (!taskRunId) {
      log("WARN", "Skipping environment error update without taskRunId", {
        terminalId,
      });
      return;
    }
    emitEnvironmentError(state);
  };

  const maintenanceTask = async () => {
    if (maintenanceScript.length === 0) {
      return;
    }
    try {
      const result = await startMaintenanceScriptInTmux(
        sessionName,
        maintenanceScript,
      );
      state.maintenanceError = result.error;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.maintenanceError = `Maintenance script execution failed: ${message}`;
      log("ERROR", "Maintenance script execution failed", {
        sessionName,
        terminalId,
        error,
      });
    }
    publish();
  };

  const devTask = async () => {
    if (devScript.length === 0) {
      return;
    }
    try {
      const result = await startDevScriptInTmux(sessionName, devScript);
      state.devError = result.error;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.devError = `Dev script execution failed: ${message}`;
      log("ERROR", "Dev script execution failed", {
        sessionName,
        terminalId,
        error,
      });
    }
    publish();
  };

  if (maintenanceScript.length > 0) {
    void maintenanceTask();
  }

  if (devScript.length > 0) {
    void devTask();
  }
}
