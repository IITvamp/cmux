import type {
  EnvironmentContext,
  EnvironmentResult,
} from "../common/environment-result.js";

// Prepare Qwen CLI environment to avoid interactive auth prompts.
// We mirror the Gemini setup by ensuring ~/.qwen/settings.json exists and
// selects the OpenAI-compatible auth flow. The actual OPENAI_API_KEY is
// injected by the spawner via envVars from Convex.
// Internal helper to build environment with a provider default base URL.
async function makeQwenEnvironment(
  _ctx: EnvironmentContext,
  defaultBaseUrl: string | null,
  defaultModel: string | null
): Promise<EnvironmentResult> {
  const { readFile } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  const { Buffer } = await import("node:buffer");

  const files: EnvironmentResult["files"] = [];
  const env: Record<string, string> = {};
  const startupCommands: string[] = [];

  // Ensure .qwen directory exists
  startupCommands.push("mkdir -p ~/.qwen");

  // Merge/update ~/.qwen/settings.json with selectedAuthType = "openai"
  const qwenDir = join(homedir(), ".qwen");
  const settingsPath = join(qwenDir, "settings.json");

  type QwenSettings = {
    selectedAuthType?: string;
    useExternalAuth?: boolean;
    [key: string]: unknown;
  };

  let settings: QwenSettings = {};
  try {
    const content = await readFile(settingsPath, "utf-8");
    try {
      const parsed = JSON.parse(content) as unknown;
      if (parsed && typeof parsed === "object") {
        settings = parsed as QwenSettings;
      }
    } catch {
      // Ignore invalid JSON and recreate with defaults
    }
  } catch {
    // File might not exist; we'll create it
  }

  // Force OpenAI-compatible auth so the CLI doesn't ask interactively
  settings.selectedAuthType = "openai";
  // Ensure we don't try an external OAuth flow in ephemeral sandboxes
  if (settings.useExternalAuth === undefined) {
    settings.useExternalAuth = false;
  }

  const mergedContent = JSON.stringify(settings, null, 2) + "\n";
  files.push({
    destinationPath: "$HOME/.qwen/settings.json",
    contentBase64: Buffer.from(mergedContent).toString("base64"),
    mode: "644",
  });

  // Set sensible default base URL for the OpenAI-compatible API if none provided via settings
  if (defaultBaseUrl) env.OPENAI_BASE_URL = defaultBaseUrl;
  if (defaultModel) env.OPENAI_MODEL = defaultModel;

  return { files, env, startupCommands };
}

// OpenRouter: models like "qwen/qwen3-coder:free"
export async function getQwenOpenRouterEnvironment(
  ctx: EnvironmentContext
): Promise<EnvironmentResult> {
  return makeQwenEnvironment(
    ctx,
    "https://openrouter.ai/api/v1",
    "qwen/qwen3-coder:free"
  );
}
