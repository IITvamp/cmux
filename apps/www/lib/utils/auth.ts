import { stackServerAppJs } from "@/lib/utils/stack";

export async function getAccessTokenFromRequest(
  req: Request
): Promise<string | null> {
  try {
    const user = await stackServerAppJs.getUser({ tokenStore: req });
    if (user) {
      const { accessToken } = await user.getAuthJson();
      console.log("[auth] getAccessTokenFromRequest", { accessToken });
      if (accessToken) return accessToken;
    }
  } catch (_e) {
    return null;
  }

  return null;
}
