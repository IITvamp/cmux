import type { EnvironmentContext, EnvironmentResult } from "../common/environment-result.js";

export async function getAugmentEnvironment(_ctx: EnvironmentContext): Promise<EnvironmentResult> {
  // Lazy imports for Node-only modules
  const { readFile, readdir, stat } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { Buffer } = await import("node:buffer");
  const { join } = await import("node:path");

  const files: EnvironmentResult["files"] = [];
  const env: Record<string, string> = {};
  const startupCommands: string[] = [];

  // Ensure Augment cache/auth directory exists in the container
  startupCommands.push("mkdir -p ~/.augment");

  const hostAugmentDir = join(homedir(), ".augment");

  // Helper: copy one file from host .augment into container .augment
  async function copyAugmentFile(filename: string, mode: string = "600") {
    try {
      const content = await readFile(join(hostAugmentDir, filename));
      files.push({
        destinationPath: `$HOME/.augment/${filename}`,
        contentBase64: content.toString("base64"),
        mode,
      });
      return true;
    } catch {
      return false;
    }
  }

  // Primary session file produced by `auggie login`
  await copyAugmentFile("session.json", "600");

  // Opportunistically mirror other simple JSON/text files (non-recursive)
  try {
    const items = await readdir(hostAugmentDir, { withFileTypes: true });
    for (const it of items) {
      if (!it.isFile()) continue;
      const name = it.name;
      if (name === "session.json") continue; // already copied
      if (!/(\.json|\.txt|\.token|_id)$/i.test(name)) continue;
      try {
        const content = await readFile(join(hostAugmentDir, name));
        files.push({
          destinationPath: `$HOME/.augment/${name}`,
          contentBase64: content.toString("base64"),
          mode: "600",
        });
      } catch {
        // ignore individual failures
      }
    }
  } catch {
    // host .augment dir missing; rely on environment variables instead
  }

  // If the user has exported env auth, forward it
  if (process.env.AUGMENT_API_TOKEN) {
    env.AUGMENT_API_TOKEN = process.env.AUGMENT_API_TOKEN;
  }
  if (process.env.AUGMENT_SESSION_AUTH) {
    env.AUGMENT_SESSION_AUTH = process.env.AUGMENT_SESSION_AUTH;
  }

  return { files, env, startupCommands };
}

