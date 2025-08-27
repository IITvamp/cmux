export async function checkQwenRequirements(): Promise<string[]> {
  // Qwen now uses OpenRouter API key with OpenAI-compatible mode.
  // Key presence is validated by the server using Settings (Convex DB),
  // so no local preflight checks are necessary here.
  //
  // However, we still need to check for the presence of the OpenRouter API key
  // in the environment variables.
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    return ["OPENROUTER_API_KEY is not set"];
  }
  return [];
}
