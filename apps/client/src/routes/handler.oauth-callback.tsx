import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStackApp, useUser } from "@stackframe/stack";

export const Route = createFileRoute("/handler/oauth-callback")({
  component: OAuthCallbackHandler,
});

function OAuthCallbackHandler() {
  const navigate = useNavigate();
  const app = useStackApp();
  const user = useUser();

  useEffect(() => {
    // The StackProvider should automatically handle the OAuth callback
    // We just need to wait for the user to be authenticated
    const checkAuth = async () => {
      // Give Stack Auth time to process the OAuth callback
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if user is authenticated
      if (user) {
        console.log("User authenticated, redirecting to dashboard");
        navigate({ to: "/dashboard" });
      } else {
        console.log("No user found after OAuth callback");
        // Try one more time after another delay
        setTimeout(() => {
          if (user) {
            navigate({ to: "/dashboard" });
          } else {
            console.error("Authentication failed");
            navigate({ to: "/auth/login" });
          }
        }, 2000);
      }
    };

    checkAuth();
  }, [user, navigate, app]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="mb-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Completing sign in...</p>
        <p className="text-sm text-gray-500 mt-2">Please wait while we authenticate you...</p>
      </div>
    </div>
  );
}