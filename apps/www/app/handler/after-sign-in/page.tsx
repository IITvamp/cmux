import { stackServerApp } from "@/app/stack";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AfterSignInPage() {
  // Ensure user is authenticated; if not, Stack will redirect to sign-in
  const user = await stackServerApp.getUser({ or: "redirect" });

  // Get current session tokens to retrieve the refresh token
  const tokens = await user.currentSession.getTokens();
  const refreshToken = tokens.refreshToken;

  if (refreshToken) {
    const target = `cmux://auth-callback?refresh_token=${encodeURIComponent(
      refreshToken
    )}`;
    redirect(target);
  }

  // Fallback: if we cannot retrieve the refresh token, send back to home
  redirect("/");
}

