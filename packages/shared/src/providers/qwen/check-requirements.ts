export async function checkQwenOpenRouterRequirements(
  apiKeys?: Record<string, string>
): Promise<string[]> {
  // No local preflight checks required. Key presence is validated by
  // the server (Settings -> Convex DB) and reported in Provider Status.
  const openRouterApiKey = apiKeys?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    return ["OPENROUTER_API_KEY is not set"];
  }
  return [];
}

export async function checkQwenModelStudioRequirements(
  apiKeys?: Record<string, string>
): Promise<string[]> {
  // No local preflight checks required. Key presence is validated by
  // the server (Settings -> Convex DB) and reported in Provider Status.
  const modelStudioApiKey = apiKeys?.MODEL_STUDIO_API_KEY || process.env.MODEL_STUDIO_API_KEY;
  if (!modelStudioApiKey) {
    return ["MODEL_STUDIO_API_KEY is not set"];
  }

  return [];
}
