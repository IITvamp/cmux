export async function checkAugmentRequirements(): Promise<string[]> {
  const { access, stat } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");

  const missing: string[] = [];

  // Accept either local session file or env-based auth
  const sessionPath = join(homedir(), ".augment", "session.json");
  const hasSessionFile = await access(sessionPath)
    .then(() => true)
    .catch(() => false);

  const hasEnvAuth = Boolean(
    process.env.AUGMENT_API_TOKEN || process.env.AUGMENT_SESSION_AUTH
  );

  if (!hasSessionFile && !hasEnvAuth) {
    missing.push("Augment authentication (run 'auggie login' locally)");
  }

  // Optional note: ensure the default cache dir exists if present locally
  const augmentDir = join(homedir(), ".augment");
  try {
    const s = await stat(augmentDir);
    if (!s.isDirectory()) {
      // nothing; directory missing isn't fatal
    }
  } catch {
    // missing dir isn't fatal
  }

  return missing;
}

