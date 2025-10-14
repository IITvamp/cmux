import type { MorphInstance } from "./git";
import { singleQuote } from "./shell";

const WORKSPACE_ROOT = "/root/workspace";
const DEFAULT_GIT_BRANCH = "main";
const CMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";
const MAINTENANCE_WINDOW_NAME = "maintenance";
const MAINTENANCE_SCRIPT_FILENAME = "maintenance.sh";
const DEV_WINDOW_NAME = "dev";
const DEV_SCRIPT_FILENAME = "dev.sh";

export type ScriptIdentifiers = {
  maintenance: {
    windowName: string;
    scriptPath: string;
  };
  dev: {
    windowName: string;
    scriptPath: string;
  };
};

export const allocateScriptIdentifiers = (): ScriptIdentifiers => {
  return {
    maintenance: {
      windowName: MAINTENANCE_WINDOW_NAME,
      scriptPath: `${CMUX_RUNTIME_DIR}/${MAINTENANCE_SCRIPT_FILENAME}`,
    },
    dev: {
      windowName: DEV_WINDOW_NAME,
      scriptPath: `${CMUX_RUNTIME_DIR}/${DEV_SCRIPT_FILENAME}`,
    },
  };
};

type ScriptResult = {
  maintenanceError: string | null;
  devError: string | null;
};

const buildGitPullCommand = (): string => {
  const gitPullScript = `set -u
WORKSPACE_ROOT=${singleQuote(WORKSPACE_ROOT)}
TARGET_BRANCH=${singleQuote(DEFAULT_GIT_BRANCH)}

if [ ! -d "$WORKSPACE_ROOT" ]; then
  echo "Workspace root does not exist: $WORKSPACE_ROOT" >&2
  exit 1
fi

failures=0
repo_count=0

get_repo_paths() {
  {
    if [ -d "$WORKSPACE_ROOT/.git" ]; then
      printf '%s\\n' "$WORKSPACE_ROOT"
    fi
    find "$WORKSPACE_ROOT" -mindepth 1 -maxdepth 3 -type d -name ".git" -print 2>/dev/null | sed 's|/\\.git$||'
  } | awk 'NF && !seen[$0]++'
}

while IFS= read -r repo_path; do
  if [ -z "$repo_path" ]; then
    continue
  fi

  repo_count=$((repo_count + 1))

  if [[ "$repo_path" == "$WORKSPACE_ROOT" ]]; then
    rel="."
  else
    rel="\${repo_path#$WORKSPACE_ROOT/}"
  fi

  echo "Updating repository: $rel"

  if ! git -C "$repo_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Skipping $rel (not a git repository)" >&2
    continue
  fi

  if ! git -C "$repo_path" rev-parse --verify "origin/$TARGET_BRANCH" >/dev/null 2>&1; then
    echo "Skipping $rel (origin/$TARGET_BRANCH not found)"
    continue
  fi

  current_branch="$(git -C "$repo_path" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

  if [[ "$current_branch" != "$TARGET_BRANCH" ]]; then
    if git -C "$repo_path" show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
      echo "Switching $rel to branch $TARGET_BRANCH"
      if ! git -C "$repo_path" checkout "$TARGET_BRANCH"; then
        echo "Failed to checkout $TARGET_BRANCH in $rel" >&2
        failures=1
        continue
      fi
    else
      echo "Creating branch $TARGET_BRANCH in $rel"
      if ! git -C "$repo_path" checkout -b "$TARGET_BRANCH" "origin/$TARGET_BRANCH"; then
        echo "Failed to create branch $TARGET_BRANCH in $rel" >&2
        failures=1
        continue
      fi
    fi
  fi

  if ! git -C "$repo_path" pull --ff-only origin "$TARGET_BRANCH"; then
    echo "Failed to pull origin/$TARGET_BRANCH in $rel" >&2
    failures=1
  fi
done < <(get_repo_paths)

if [ "$repo_count" -eq 0 ]; then
  echo "No git repositories found under $WORKSPACE_ROOT"
  exit 0
fi

if [[ "$failures" -ne 0 ]]; then
  echo "One or more repositories failed to update" >&2
  exit 1
fi
`;

  return `bash <<'CMUX_GIT_PULL'\n${gitPullScript}\nCMUX_GIT_PULL`;
};

export async function runMaintenanceAndDevScripts({
  instance,
  maintenanceScript,
  devScript,
  identifiers,
}: {
  instance: MorphInstance;
  maintenanceScript?: string;
  devScript?: string;
  identifiers?: ScriptIdentifiers;
}): Promise<ScriptResult> {
  const ids = identifiers ?? allocateScriptIdentifiers();

  const hasMaintenanceScript = Boolean(
    maintenanceScript && maintenanceScript.trim().length > 0,
  );
  const hasDevScript = Boolean(devScript && devScript.trim().length > 0);

  if (!hasMaintenanceScript && !hasDevScript) {
    return {
      maintenanceError: "Both maintenance and dev scripts are empty",
      devError: null,
    };
  }

  const waitForTmuxSession = `for i in {1..20}; do
  if tmux has-session -t cmux 2>/dev/null; then
    break
  fi
  sleep 0.5
done
if ! tmux has-session -t cmux 2>/dev/null; then
  echo "Error: cmux session does not exist" >&2
  exit 1
fi`;

  let maintenanceError: string | null = null;
  let devError: string | null = null;

  const gitPullCommand = buildGitPullCommand();
  try {
    const gitResult = await instance.exec(
      `zsh -lc ${singleQuote(gitPullCommand)}`,
    );

    if (gitResult.exit_code !== 0) {
      const stderr = gitResult.stderr?.trim() || "";
      const stdout = gitResult.stdout?.trim() || "";
      const messageParts = [
        `Failed to update repositories before running scripts (exit ${gitResult.exit_code})`,
        stderr ? `stderr: ${stderr}` : null,
        stdout ? `stdout: ${stdout}` : null,
      ].filter((part): part is string => part !== null);
      const message = messageParts.join(" | ");

      if (hasMaintenanceScript) {
        maintenanceError = message;
      }
      if (hasDevScript) {
        devError = message;
      }

      return {
        maintenanceError,
        devError,
      };
    }

    const stdout = gitResult.stdout?.trim();
    if (stdout) {
      const truncated =
        stdout.length > 2000 ? `${stdout.slice(0, 2000)}...` : stdout;
      console.log(`[GIT PULL]\n${truncated}`);
    }
    const stderr = gitResult.stderr?.trim();
    if (stderr) {
      const truncated =
        stderr.length > 2000 ? `${stderr.slice(0, 2000)}...` : stderr;
      console.log(`[GIT PULL ERR]\n${truncated}`);
    }
  } catch (error) {
    const message = `Failed to execute git pull command: ${
      error instanceof Error ? error.message : String(error)
    }`;
    if (hasMaintenanceScript) {
      maintenanceError = message;
    }
    if (hasDevScript) {
      devError = message;
    }
    return {
      maintenanceError,
      devError,
    };
  }

  if (hasMaintenanceScript && maintenanceScript) {
    const maintenanceRunId = `maintenance_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    const maintenanceExitCodePath = `${ids.maintenance.scriptPath}.${maintenanceRunId}.exit-code`;

    const maintenanceScriptContent = `#!/bin/zsh
set -eux
cd ${WORKSPACE_ROOT}

echo "=== Maintenance Script Started at \$(date) ==="
${maintenanceScript}
echo "=== Maintenance Script Completed at \$(date) ==="
`;

    const maintenanceWindowCommand = `zsh "${ids.maintenance.scriptPath}"
EXIT_CODE=$?
echo "$EXIT_CODE" > "${maintenanceExitCodePath}"
if [ "$EXIT_CODE" -ne 0 ]; then
  echo "[MAINTENANCE] Script exited with code $EXIT_CODE" >&2
else
  echo "[MAINTENANCE] Script completed successfully"
fi
exec zsh`;

    const maintenanceCommand = `set -eu
mkdir -p ${CMUX_RUNTIME_DIR}
cat > ${ids.maintenance.scriptPath} <<'SCRIPT_EOF'
${maintenanceScriptContent}
SCRIPT_EOF
chmod +x ${ids.maintenance.scriptPath}
rm -f ${maintenanceExitCodePath}
${waitForTmuxSession}
tmux new-window -t cmux: -n ${ids.maintenance.windowName} -d ${singleQuote(maintenanceWindowCommand)}
sleep 2
if tmux list-windows -t cmux | grep -q "${ids.maintenance.windowName}"; then
  echo "[MAINTENANCE] Window is running"
else
  echo "[MAINTENANCE] Window may have exited (normal if script completed)"
fi
while [ ! -f ${maintenanceExitCodePath} ]; do
  sleep 1
done
MAINTENANCE_EXIT_CODE=0
if [ -f ${maintenanceExitCodePath} ]; then
  MAINTENANCE_EXIT_CODE=$(cat ${maintenanceExitCodePath} || echo 0)
else
  echo "[MAINTENANCE] Missing exit code file; assuming failure" >&2
  MAINTENANCE_EXIT_CODE=1
fi
rm -f ${maintenanceExitCodePath}
echo "[MAINTENANCE] Wait complete with exit code $MAINTENANCE_EXIT_CODE"
exit $MAINTENANCE_EXIT_CODE
`;

    try {
      const result = await instance.exec(
        `zsh -lc ${singleQuote(maintenanceCommand)}`,
      );

      if (result.exit_code !== 0) {
        const stderr = result.stderr?.trim() || "";
        const stdout = result.stdout?.trim() || "";
        const messageParts = [
          `Maintenance script finished with exit code ${result.exit_code}`,
          stderr ? `stderr: ${stderr}` : null,
          stdout ? `stdout: ${stdout}` : null,
        ].filter((part): part is string => part !== null);
        maintenanceError = messageParts.join(" | ");
      } else {
        console.log(`[MAINTENANCE SCRIPT VERIFICATION]\n${result.stdout || ""}`);
      }
    } catch (error) {
      maintenanceError = `Maintenance script execution failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (hasDevScript && devScript) {
    const devScriptContent = `#!/bin/zsh
set -ux
cd ${WORKSPACE_ROOT}

echo "=== Dev Script Started at \$(date) ==="
${devScript}
`;

    const devCommand = `set -eu
mkdir -p ${CMUX_RUNTIME_DIR}
cat > ${ids.dev.scriptPath} <<'SCRIPT_EOF'
${devScriptContent}
SCRIPT_EOF
chmod +x ${ids.dev.scriptPath}
${waitForTmuxSession}
tmux new-window -t cmux: -n ${ids.dev.windowName} -d
tmux send-keys -t cmux:${ids.dev.windowName} "zsh ${ids.dev.scriptPath}" C-m
sleep 2
if tmux list-windows -t cmux | grep -q "${ids.dev.windowName}"; then
  echo "[DEV] Window is running"
else
  echo "[DEV] ERROR: Window not found" >&2
  exit 1
fi
`;

    try {
      const result = await instance.exec(`zsh -lc ${singleQuote(devCommand)}`);

      if (result.exit_code !== 0) {
        const stderr = result.stderr?.trim() || "";
        const stdout = result.stdout?.trim() || "";
        const messageParts = [
          `Failed to start dev script with exit code ${result.exit_code}`,
          stderr ? `stderr: ${stderr}` : null,
          stdout ? `stdout: ${stdout}` : null,
        ].filter((part): part is string => part !== null);
        devError = messageParts.join(" | ");
      } else {
        console.log(`[DEV SCRIPT VERIFICATION]\n${result.stdout || ""}`);
      }
    } catch (error) {
      devError = `Dev script execution failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return {
    maintenanceError,
    devError,
  };
}
