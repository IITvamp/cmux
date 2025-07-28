import type { EnvironmentResult } from "../common/environment-result.js";

export async function getOpencodeEnvironment(): Promise<EnvironmentResult> {
  const { readFile } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { Buffer } = await import("node:buffer");
  const files: EnvironmentResult["files"] = [];
  const env: Record<string, string> = {};
  const startupCommands: string[] = [];

  // Ensure .local/share/opencode directory exists
  startupCommands.push("mkdir -p ~/.local/share/opencode");

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

  return { files, env, startupCommands };
}