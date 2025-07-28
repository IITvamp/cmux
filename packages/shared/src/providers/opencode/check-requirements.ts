export async function checkOpencodeRequirements(): Promise<string[]> {
  const { access } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  
  const missing: string[] = [];

  try {
    // Check for auth.json
    await access(join(homedir(), ".local", "share", "opencode", "auth.json"));
  } catch {
    missing.push(".local/share/opencode/auth.json file");
  }

  return missing;
}