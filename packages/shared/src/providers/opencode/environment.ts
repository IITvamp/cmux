import type {
  EnvironmentContext,
  EnvironmentResult,
} from "../common/environment-result";

async function buildOpencodeEnvironment(
  _ctx: EnvironmentContext,
  opts: { skipAuth: boolean }
): Promise<EnvironmentResult> {
  // These must be lazy since configs are imported into the browser
  const { readFile } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { Buffer } = await import("node:buffer");
  const files: EnvironmentResult["files"] = [];
  const env: Record<string, string> = {};
  const startupCommands: string[] = [];

  // Ensure .local/share/opencode directory exists
  startupCommands.push("mkdir -p ~/.local/share/opencode");
  // Ensure OpenCode plugin directory exists
  startupCommands.push("mkdir -p ~/.config/opencode/plugin");

  // Copy auth.json unless explicitly skipped (grok-code doesn't need it)
  if (!opts.skipAuth) {
    try {
      const authContent = await readFile(
        `${homedir()}/.local/share/opencode/auth.json`,
        "utf-8"
      );
      files.push({
        destinationPath: "$HOME/.local/share/opencode/auth.json",
        contentBase64: Buffer.from(authContent).toString("base64"),
        mode: "600",
      });
    } catch (error) {
      console.warn("Failed to read opencode auth.json:", error);
    }
  }

  // Ensure lifecycle directories exist for completion markers and hook assets
  startupCommands.push("mkdir -p /root/lifecycle");
  startupCommands.push("mkdir -p /root/lifecycle/opencode");

  const completionHookScript = `#!/bin/sh
set -eu

LOG_FILE="/root/lifecycle/opencode/session-hook.log"
TASK_ID="\${CMUX_TASK_RUN_ID:-unknown}"
MARKER_DIR="/root/lifecycle"
MARKER_FILE="\${MARKER_DIR}/opencode-complete-\${TASK_ID}"

{
  echo "[CMUX Opencode Hook] Started at $(date)"
  echo "[CMUX Opencode Hook] Task run ID: \${TASK_ID}"
} >> "\${LOG_FILE}" 2>&1

mkdir -p "\${MARKER_DIR}"
printf "%s\n" "$(date +%s)" > "\${MARKER_FILE}"

{
  echo "[CMUX Opencode Hook] Created marker file: \${MARKER_FILE}"
  ls -la "\${MARKER_FILE}" 2>/dev/null || true
} >> "\${LOG_FILE}" 2>&1

exit 0
`;

  files.push({
    destinationPath: "/root/lifecycle/opencode/session-complete.sh",
    contentBase64: Buffer.from(completionHookScript).toString("base64"),
    mode: "755",
  });

  // Install OpenCode Notification plugin to trigger the completion hook
  const pluginContent = `\
export const NotificationPlugin = async ({ $ }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await $\`/root/lifecycle/opencode/session-complete.sh\`
      }
    },
  }
}
`;

  files.push({
    destinationPath: "$HOME/.config/opencode/plugin/notification.js",
    contentBase64: Buffer.from(pluginContent).toString("base64"),
    mode: "644",
  });

  return { files, env, startupCommands };
}

export async function getOpencodeEnvironment(
  ctx: EnvironmentContext
): Promise<EnvironmentResult> {
  return buildOpencodeEnvironment(ctx, { skipAuth: false });
}

export async function getOpencodeEnvironmentSkipAuth(
  ctx: EnvironmentContext
): Promise<EnvironmentResult> {
  return buildOpencodeEnvironment(ctx, { skipAuth: true });
}
