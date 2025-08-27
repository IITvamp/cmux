export async function checkQwenOpenRouterRequirements(): Promise<string[]> {
  // No local preflight checks required. Key presence is validated by
  // the server (Settings -> Convex DB) and reported in Provider Status.
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    return ["OPENROUTER_API_KEY is not set"];
  }
  return [];
}

export async function checkQwenModelStudioRequirements(): Promise<string[]> {
  // No local preflight checks required. Key presence is validated by
  // the server (Settings -> Convex DB) and reported in Provider Status.
  const modelStudioApiKey = process.env.MODEL_STUDIO_API_KEY;
  if (!modelStudioApiKey) {
    return ["MODEL_STUDIO_API_KEY is not set"];
  }

  return [];
}
