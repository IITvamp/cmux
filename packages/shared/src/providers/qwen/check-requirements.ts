export async function checkQwenRequirements(): Promise<string[]> {
  const { access, readFile } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");

  const missing: string[] = [];
  const qwenDir = join(homedir(), ".qwen");

  // settings.json is optional, but if neither settings nor OPENAI_API_KEY exists,
  // hint that auth may be needed.
  let hasSettings = false;
  try {
    await access(join(qwenDir, "settings.json"));
    hasSettings = true;
  } catch {
    // not present
  }

  if (!hasSettings) {
    // Check for OPENAI_API_KEY in .env files
    const envPaths = [join(qwenDir, ".env"), join(homedir(), ".env")];
    let hasApiKey = !!process.env.OPENAI_API_KEY;
    for (const envPath of envPaths) {
      try {
        const content = await readFile(envPath, "utf-8");
        if (content.includes("OPENAI_API_KEY=")) {
          hasApiKey = true;
          break;
        }
      } catch {
        // ignore
      }
    }
    if (!hasApiKey) {
      // Keep this light; OAuth flow can also be used at runtime
      // so do not block on requirements.
    }
  }

  return missing;
}

