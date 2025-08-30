export async function checkAugmentRequirements(): Promise<string[]> {
  // These must be lazy since configs are imported into the browser
  const { existsSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");

  const missingRequirements: string[] = [];
  const homeDir = homedir();
  const augmentConfigPath = join(homeDir, ".augment", "config.json");
  const augmentAuthPath = join(homeDir, ".augment", "auth.json");

  // Check for authentication - either auth.json or API key
  let hasAuth = false;

  // Check for auth.json file
  if (existsSync(augmentAuthPath)) {
    hasAuth = true;
  }

  // Check for AUGMENT_API_KEY environment variable
  if (!hasAuth && process.env.AUGMENT_API_KEY) {
    hasAuth = true;
  }

  if (!hasAuth) {
    missingRequirements.push(
      "Augment authentication not found. Please either:\n" +
        "  - Set AUGMENT_API_KEY environment variable\n" +
        "  - Ensure ~/.augment/auth.json exists (run 'auggie login' locally first)",
    );
  }

  if (!existsSync(augmentConfigPath)) {
    missingRequirements.push(
      "Augment config not found at ~/.augment/config.json",
    );
  }

  return missingRequirements;
}
