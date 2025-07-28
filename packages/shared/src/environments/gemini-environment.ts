import type { EnvironmentResult } from "./environment-result.js";

export async function getGeminiEnvironment(): Promise<EnvironmentResult> {
  // These must be lazy since configs are imported into the browser
  const { readFile, stat } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { Buffer } = await import("node:buffer");
  const { join } = await import("node:path");

  const files: EnvironmentResult["files"] = [];
  const env: Record<string, string> = {};
  const startupCommands: string[] = [];

  // Ensure .gemini directory exists
  startupCommands.push("mkdir -p ~/.gemini");
  startupCommands.push("mkdir -p ~/.gemini/commands");

  const geminiDir = join(homedir(), ".gemini");

  // Helper function to safely copy file
  async function copyFile(
    filename: string,
    destinationPath: string,
    mode: string = "644"
  ) {
    try {
      const content = await readFile(join(geminiDir, filename), "utf-8");
      files.push({
        destinationPath,
        contentBase64: Buffer.from(content).toString("base64"),
        mode,
      });
      return true;
    } catch (error: any) {
      // Only log if it's not a "file not found" error
      if (error.code !== "ENOENT") {
        console.warn(`Failed to read ${filename}:`, error);
      }
      return false;
    }
  }

  // 1. Settings file (required)
  await copyFile("settings.json", "$HOME/.gemini/settings.json");

  // 2. OAuth tokens (if exists)
  await copyFile("oauth_creds.json", "$HOME/.gemini/oauth_creds.json", "600");
  await copyFile(
    "mcp-oauth-tokens.json",
    "$HOME/.gemini/mcp-oauth-tokens.json",
    "600"
  );

  // 3. Google account authentication
  await copyFile(
    "google_accounts.json",
    "$HOME/.gemini/google_accounts.json",
    "600"
  );
  await copyFile("google_account_id", "$HOME/.gemini/google_account_id");

  // 4. Installation and user IDs
  await copyFile("installation_id", "$HOME/.gemini/installation_id");
  await copyFile("user_id", "$HOME/.gemini/user_id");

  // 5. Check for .env files
  const envPaths = [join(geminiDir, ".env"), join(homedir(), ".env")];

  for (const envPath of envPaths) {
    try {
      const content = await readFile(envPath, "utf-8");
      const filename =
        envPath === join(geminiDir, ".env") ? ".gemini/.env" : ".env";
      files.push({
        destinationPath: `$HOME/${filename}`,
        contentBase64: Buffer.from(content).toString("base64"),
        mode: "600",
      });
      break; // Use first found .env file
    } catch {
      // Continue to next path
    }
  }

  // 6. Check for commands directory
  try {
    const commandsDir = join(geminiDir, "commands");
    const stats = await stat(commandsDir);
    if (stats.isDirectory()) {
      // Create commands directory in destination
      startupCommands.push("mkdir -p ~/.gemini/commands");
      // Note: We're not copying the contents of commands directory
      // as it may contain many files and we don't know what's needed
    }
  } catch {
    // Commands directory doesn't exist
  }

  return { files, env, startupCommands };
}
