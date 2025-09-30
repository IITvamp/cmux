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

  // Ensure lifecycle directory for completion markers
  startupCommands.push("mkdir -p /root/lifecycle/opencode");
  startupCommands.push(
    "rm -f /root/lifecycle/opencode-complete-* 2>/dev/null || true"
  );

  // Install OpenCode Notification plugin to detect session completion via lifecycle hook
  const completionScript = `#!/bin/sh\nset -euo pipefail\n\nMARKER_DIR="/root/lifecycle"\nTASK_ID="\${CMUX_TASK_RUN_ID:-unknown}"\nMARKER_FILE="\${MARKER_DIR}/opencode-complete-\${TASK_ID}"\n\nmkdir -p "\${MARKER_DIR}"\n# Write a timestamp so repeated triggers are visible\nprintf "%s" "\$(date +%s)" > "\${MARKER_FILE}"\n# Maintain both agent-specific and shared done markers\ntouch "\${MARKER_DIR}/opencode-done.txt" "\${MARKER_DIR}/done.txt"\n\necho "[CMUX OpenCode Hook] Created marker at \${MARKER_FILE}" >&2\n`;

  files.push({
    destinationPath: "/root/lifecycle/opencode/session-complete.sh",
    contentBase64: Buffer.from(completionScript).toString("base64"),
    mode: "755",
  });

  const pluginContent = `export const NotificationPlugin = async ({ $ }) => {\n  return {\n    event: async ({ event }) => {\n      if (event.type === "session.idle") {\n        try {\n          await $\`/root/lifecycle/opencode/session-complete.sh\`;\n        } catch (error) {\n          console.error(\"[CMUX OpenCode Hook] Failed to run completion script\", error);\n        }\n      }\n    },\n  };\n};\n`;

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
