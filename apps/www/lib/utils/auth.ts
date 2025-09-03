import { stackServerApp } from "@/lib/utils/stack";

export async function getAccessTokenFromRequest(
  req: Request
): Promise<string | null> {
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

  // Fallback 1: x-stack-auth header containing a JSON string with { accessToken, refreshToken? }
  try {
    const raw = req.headers.get("x-stack-auth");
    if (raw) {
      const parsed = JSON.parse(raw) as { accessToken?: string } | null;
      if (parsed && typeof parsed.accessToken === "string" && parsed.accessToken) {
        return parsed.accessToken;
      }
    }
  } catch (_e) {
    // ignored
  }

  // Fallback 2: Authorization: Bearer <token>
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m && m[1]) return m[1] ?? null;
  }

  return null;
}
