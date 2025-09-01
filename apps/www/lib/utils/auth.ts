import { stackServerApp } from "@/lib/utils/stack";

export async function getAccessTokenFromRequest(req: Request): Promise<string | undefined> {
  // Primary: Stack server app with request-backed token store
  try {
    const user = await stackServerApp.getUser({ tokenStore: req });
    if (user) {
      const { accessToken } = await user.getAuthJson();
      if (accessToken) return accessToken;
    }
  } catch (_e) {
    // In non-Next contexts, cookies() may not be available; fall back to headers
  }

  // Fallback 1: x-stack-auth header (JSON with accessToken)
  const hdr = req.headers.get("x-stack-auth");
  if (hdr) {
    try {
      const parsed: { accessToken?: string } = JSON.parse(hdr);
      if (parsed.accessToken) return parsed.accessToken;
    } catch {
      // ignore
    }
  }

  // Fallback 2: Authorization: Bearer <token>
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7);
  }

  return undefined;
}

