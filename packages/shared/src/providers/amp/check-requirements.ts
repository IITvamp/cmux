export async function checkAmpRequirements(): Promise<string[]> {
  const { access } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  
  const missing: string[] = [];

  // Note: .config/amp/settings.json is optional - AMP creates a default if missing

  // Check for .local/share/amp/secrets.json (contains API key)
  const hasSecretsFile = await access(
    join(homedir(), ".local", "share", "amp", "secrets.json")
  )
    .then(() => true)
    .catch(() => false);

  // Also check for AMP_API_KEY environment variable
  if (!hasSecretsFile && !process.env.AMP_API_KEY) {
    missing.push("AMP API key (no secrets.json or AMP_API_KEY env var)");
  }

  return missing;
}