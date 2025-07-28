export async function checkOpenAIRequirements(): Promise<string[]> {
  const { access } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  
  const missing: string[] = [];

  // Check for .codex/auth.json (required for Codex CLI)
  try {
    await access(join(homedir(), ".codex", "auth.json"));
  } catch {
    missing.push(".codex/auth.json file");
  }

  // Check for .codex/config.json
  try {
    await access(join(homedir(), ".codex", "config.json"));
  } catch {
    missing.push(".codex/config.json file");
  }

  return missing;
}