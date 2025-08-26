import type {
  EnvironmentContext,
  EnvironmentResult,
} from "../common/environment-result.js";

export async function getOpencodeEnvironment(
  _ctx: EnvironmentContext
): Promise<EnvironmentResult> {
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

  // Ensure lifecycle directory for completion markers
  startupCommands.push("mkdir -p /root/lifecycle");

  // Install OpenCode Notification plugin to detect session completion
  const pluginContent = `\
export const NotificationPlugin = async ({ client, $ }) => {
  return {
    event: async ({ event }) => {
      // Send notification on session completion
      if (event.type === "session.idle") {
        // Trace marker to help debugging whether plugin fires
        try {
          await $\`bash -lc "echo [cmux] OpenCode plugin idle at $(date -Iseconds) >> /root/lifecycle/opencode-plugin.log"\`
        } catch (_) {}

        // Best-effort macOS notify; ignore errors on Linux
        try {
          await $\`osascript -e 'display notification "Session completed!" with title "opencode"'\`
        } catch (_) {}

        // Always drop a completion marker for cmux worker
        try {
          await $\`bash -lc "mkdir -p /root/lifecycle && echo done > /root/lifecycle/opencode-complete-$CMUX_TASK_RUN_ID"\`
        } catch (e1) {
          try {
            await $\`sh -lc "mkdir -p /root/lifecycle && echo done > /root/lifecycle/opencode-complete-$CMUX_TASK_RUN_ID"\`
          } catch (_) {}
        }
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
