export async function checkCursorRequirements(
  apiKeys?: Record<string, string>
): Promise<string[]> {
  // These must be lazy since configs are imported into the browser
  const { existsSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);

  const missingRequirements: string[] = [];
  const homeDir = homedir();
  const cursorCliConfigPath = join(homeDir, ".cursor", "cli-config.json");
  const cursorAuthPath = join(homeDir, ".config", "cursor", "auth.json");
  
  // Check for authentication - either auth.json, keychain tokens, or API key
  let hasAuth = false;
  
  // Check for auth.json file
  if (existsSync(cursorAuthPath)) {
    hasAuth = true;
  }
  
  // Check for keychain tokens if no auth.json
  if (!hasAuth) {
    try {
      const [accessTokenResult, refreshTokenResult] = await Promise.all([
        execAsync("security find-generic-password -w -s 'cursor-access-token'").catch(() => null),
        execAsync("security find-generic-password -w -s 'cursor-refresh-token'").catch(() => null)
      ]);
      
      if (accessTokenResult && refreshTokenResult) {
        hasAuth = true;
      }
    } catch {
      // Silent fail - tokens not in keychain
    }
  }
  
  // Check for CURSOR_API_KEY environment variable or in provided API keys
  if (!hasAuth && (apiKeys?.CURSOR_API_KEY || process.env.CURSOR_API_KEY)) {
    hasAuth = true;
  }
  
  if (!hasAuth) {
    missingRequirements.push(
      "Cursor authentication not found. Please either:\n" +
      "  - Set CURSOR_API_KEY environment variable\n" +
      "  - Ensure ~/.config/cursor/auth.json exists\n" +
      "  - Have cursor-access-token and cursor-refresh-token in macOS keychain"
    );
  }
  
  if (!existsSync(cursorCliConfigPath)) {
    missingRequirements.push(
      "Cursor CLI config not found at ~/.cursor/cli-config.json"
    );
  }
  
  return missingRequirements;
}