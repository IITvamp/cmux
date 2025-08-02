import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStackApp, useUser } from "@stackframe/stack";

export const Route = createFileRoute("/handler/oauth-callback")({
  component: OAuthCallbackHandler,
});

function OAuthCallbackHandler() {
  const navigate = useNavigate();
  const app = useStackApp();
  const user = useUser();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we already have a user (Stack Auth might have processed it)
    if (user) {
      console.log("User already authenticated, redirecting to dashboard");
      window.location.href = "/dashboard";
      return;
    }

    const handleOAuthCallback = async () => {
      try {
        // Get the full URL with parameters
        const fullUrl = window.location.href;
        console.log("OAuth callback URL:", fullUrl);

        // Let Stack Auth handle the OAuth callback
        // The SDK should automatically process the code and state parameters
        const success = await app.callOAuthCallback();
        
        console.log("OAuth callback result:", success);

        if (success) {
          // Wait a moment for the auth state to update
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Get the authenticated user
          const userInfo = await app.getUser();
          
          if (userInfo) {
            console.log("User authenticated successfully:", userInfo.id);
            // Redirect to dashboard
            window.location.href = "/dashboard";
          } else {
            throw new Error("Failed to get user info after OAuth");
          }
        } else {
          throw new Error("OAuth callback failed");
        }
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        
        // Redirect to login after showing error
        setTimeout(() => {
          navigate({ to: "/auth/login" });
        }, 3000);
      }
    };

    // Only process if we have OAuth parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code') && urlParams.has('state')) {
      handleOAuthCallback();
    } else if (urlParams.has('error')) {
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');
      setError(errorDescription || error || "Authentication failed");
      setTimeout(() => navigate({ to: "/auth/login" }), 3000);
    } else {
      // No OAuth parameters, redirect to login
      console.error("No OAuth parameters found");
      navigate({ to: "/auth/login" });
    }
  }, [app, user, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

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