import { useStackApp } from "@stackframe/react";
import { useEffect } from "react";

export function AuthCallbackHandler() {
  const stackApp = useStackApp();

  useEffect(() => {
    // Listen for auth callback from electron main process
    const handleAuthCallback = (data: { refreshToken: string }) => {
      if (data.refreshToken) {
        // Set the refresh token in StackAuth
        stackApp
          .signInWithRefreshToken(data.refreshToken)
          .then(() => {
            // Redirect to dashboard or main app
            window.location.href = "/";
          })
          .catch((error) => {
            console.error("Failed to sign in with refresh token:", error);
            // Handle error - maybe show a notification
          });
      }
    };

    // @ts-expect-error - window.api is exposed by preload script
    if (window.api?.onAuthCallback) {
      // @ts-expect-error - window.api is exposed by preload script
      window.api.onAuthCallback(handleAuthCallback);
    }

    return () => {
      // @ts-expect-error - window.api is exposed by preload script
      if (window.api?.removeAuthCallback) {
        // @ts-expect-error - window.api is exposed by preload script
        window.api.removeAuthCallback();
      }
    };
  }, [stackApp]);

  return null; // This component doesn't render anything
}
