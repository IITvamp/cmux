"use client";

import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { stackClientApp } from "@/stack";

export function OAuthCallbackHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleOAuthCallback = async (data: {
      refreshToken: string;
      state?: string;
    }) => {
      try {
        // Sign in with the refresh token
        await stackClientApp.signInWithRefreshToken(data.refreshToken);

        // Navigate to the appropriate page
        const redirectTo = data.state || "/";
        router.navigate({ to: redirectTo });
      } catch (error) {
        console.error("Failed to sign in with refresh token:", error);
        // Navigate to sign-in page on error
        router.navigate({ to: "/sign-in" });
      }
    };

    // Listen for OAuth callback from electron main process
    if (window.api) {
      window.api.onOAuthCallback(handleOAuthCallback);
    }

    // Cleanup
    return () => {
      if (window.api) {
        window.api.removeOAuthCallbackListener();
      }
    };
  }, [router]);

  return null; // This component doesn't render anything
}
