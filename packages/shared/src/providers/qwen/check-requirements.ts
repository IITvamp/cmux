export async function checkQwenRequirements(): Promise<string[]> {
  const { readFile, stat } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");

  const missing: string[] = [];

  // Qwen in cmux must use API-key auth (no OAuth). Use OpenAI-compatible key.
  let hasApiKey = !!process.env.OPENAI_API_KEY;
  if (!hasApiKey) {
    const home = homedir();
    const envCandidates = [join(home, ".env")];
    for (const p of envCandidates) {
      try {
        const s = await stat(p);
        if (!s.isFile()) continue;
        const content = await readFile(p, "utf-8");
        if (content.includes("OPENAI_API_KEY=")) {
          hasApiKey = true;
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  if (!hasApiKey) {
    missing.push("Qwen requires OPENAI_API_KEY (OpenAI-compatible API key)");
  }

  return missing;
}
