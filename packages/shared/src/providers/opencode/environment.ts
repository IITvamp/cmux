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
  startupCommands.push("mkdir -p /root/lifecycle");

  // Install OpenCode Notification plugin to detect session completion
  const pluginContent = `\
export const NotificationPlugin = async ({ client, $ }) => {
  return {
    event: async ({ event }) => {
      // Send notification on session completion
      if (event.type === "session.idle") {
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
