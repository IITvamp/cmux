import type {
  EnvironmentContext,
  EnvironmentResult,
} from "../common/environment-result.js";

export async function getAugmentEnvironment(
  _ctx: EnvironmentContext,
): Promise<EnvironmentResult> {
  // These must be lazy since configs are imported into the browser
  const { existsSync } = await import("node:fs");
  const { readFile } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  const { Buffer } = await import("node:buffer");

  const files: EnvironmentResult["files"] = [];
  const env: Record<string, string> = {};
  const startupCommands: string[] = [];

  const homeDir = homedir();
  const augmentConfigPath = join(homeDir, ".augment", "config.json");
  const augmentAuthPath = join(homeDir, ".augment", "auth.json");

  // Copy augment config if exists
  if (existsSync(augmentConfigPath)) {
    try {
      const content = await readFile(augmentConfigPath, "utf-8");
      files.push({
        destinationPath: "/root/.augment/config.json",
        contentBase64: Buffer.from(content).toString("base64"),
        mode: "644",
      });
    } catch (error) {
      console.warn("Failed to read augment config:", error);
    }
  }

  // Copy augment auth if exists
  if (existsSync(augmentAuthPath)) {
    try {
      const content = await readFile(augmentAuthPath, "utf-8");
      files.push({
        destinationPath: "/root/.augment/auth.json",
        contentBase64: Buffer.from(content).toString("base64"),
        mode: "600",
      });
    } catch (error) {
      console.warn("Failed to read augment auth:", error);
    }
  }

  // If AUGMENT_API_KEY environment variable is set, use it
  if (process.env.AUGMENT_API_KEY) {
    env.AUGMENT_API_KEY = process.env.AUGMENT_API_KEY;

    // Add startup command to persist the API key in .bashrc
    startupCommands.push(
      `grep -q "export AUGMENT_API_KEY=" ~/.bashrc || echo 'export AUGMENT_API_KEY="${process.env.AUGMENT_API_KEY}"' >> ~/.bashrc`,
    );
  }

  // Ensure directories exist
  startupCommands.push("mkdir -p ~/.augment");

  return { files, env, startupCommands };
}
