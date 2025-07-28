export async function checkClaudeRequirements(): Promise<string[]> {
  const { access } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);
  
  const missing: string[] = [];

  try {
    // Check for .claude.json
    await access(join(homedir(), ".claude.json"));
  } catch {
    missing.push(".claude.json file");
  }

  try {
    // Check for credentials
    const hasCredentialsFile = await access(
      join(homedir(), ".claude", ".credentials.json")
    )
      .then(() => true)
      .catch(() => false);

    if (!hasCredentialsFile) {
      // Check for API key in keychain
      try {
        await execAsync(
          "security find-generic-password -a $USER -w -s 'Claude Code'"
        );
      } catch {
        missing.push(
          "Claude credentials (no .credentials.json or API key in keychain)"
        );
      }
    }
  } catch {
    missing.push("Claude credentials");
  }

  return missing;
}