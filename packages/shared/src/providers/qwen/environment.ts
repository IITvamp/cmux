import type { EnvironmentContext, EnvironmentResult } from "../common/environment-result.js";

// Prepare Qwen CLI environment for OAuth.
// Key goals:
// - Seed container with host OAuth creds (if present)
// - Explicitly select Qwen OAuth in settings
// - Avoid stale telemetry
export async function getQwenEnvironment(_ctx: EnvironmentContext): Promise<EnvironmentResult> {
  const { readFile } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { Buffer } = await import("node:buffer");
  const { join } = await import("node:path");

  const files: EnvironmentResult["files"] = [];
  const env: Record<string, string> = {};
  const startupCommands: string[] = [];

  // Ensure directory structure and clean up old telemetry
  startupCommands.push("mkdir -p ~/.qwen");
  startupCommands.push("mkdir -p ~/.gemini");
  startupCommands.push("rm -f /tmp/qwen-telemetry-*.log 2>/dev/null || true");

  const qwenDir = join(homedir(), ".qwen");
  const geminiDir = join(homedir(), ".gemini");

  // 1) Settings: force OAuth usage explicitly
  try {
    let merged: Record<string, unknown> = {};
    try {
      const existing = await readFile(join(qwenDir, "settings.json"), "utf-8");
      merged = JSON.parse(existing) as Record<string, unknown>;
    } catch {}
    merged.selectedAuthType = "qwen-oauth";
    const content = JSON.stringify(merged, null, 2) + "\n";
    files.push({
      destinationPath: "$HOME/.qwen/settings.json",
      contentBase64: Buffer.from(content).toString("base64"),
      mode: "644",
    });
  } catch {}

  // 2) Seed cached OAuth credentials if present on host
  try {
    const creds = await readFile(join(qwenDir, "oauth_creds.json"), "utf-8");
    files.push({
      destinationPath: "$HOME/.qwen/oauth_creds.json",
      contentBase64: Buffer.from(creds).toString("base64"),
      mode: "600",
    });
  } catch {}

  // 2b) Also seed Google OAuth creds and MCP tokens if present
  try {
    const gcreds = await readFile(join(geminiDir, "oauth_creds.json"), "utf-8");
    files.push({
      destinationPath: "$HOME/.gemini/oauth_creds.json",
      contentBase64: Buffer.from(gcreds).toString("base64"),
      mode: "600",
    });
  } catch {}
  try {
    const mcp = await readFile(
      join(geminiDir, "mcp-oauth-tokens.json"),
      "utf-8"
    );
    files.push({
      destinationPath: "$HOME/.gemini/mcp-oauth-tokens.json",
      contentBase64: Buffer.from(mcp).toString("base64"),
      mode: "600",
    });
  } catch {}

  // 3) Include .env (optional)
  try {
    const content = await readFile(join(qwenDir, ".env"), "utf-8");
    files.push({
      destinationPath: "$HOME/.qwen/.env",
      contentBase64: Buffer.from(content).toString("base64"),
      mode: "600",
    });
  } catch {
    try {
      const content = await readFile(join(homedir(), ".env"), "utf-8");
      files.push({
        destinationPath: "$HOME/.env",
        contentBase64: Buffer.from(content).toString("base64"),
        mode: "600",
      });
    } catch {}
  }

  // 4) Pass through environment variables that may be used
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  if (process.env.OPENAI_API_KEY) {
    env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  }

  return { files, env, startupCommands };
}
