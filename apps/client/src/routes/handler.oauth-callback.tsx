import { useStackApp } from "@stackframe/stack";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/handler/oauth-callback")({
  component: OAuthCallbackHandler,
});

function OAuthCallbackHandler() {
  const app = useStackApp();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Stack Auth handles the OAuth callback automatically
    // The StackProvider will process the OAuth response
    // and update the user state
    
    // Check if we have a user after a short delay
    const timer = setTimeout(() => {
      navigate({ to: "/dashboard" });
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [app, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="mb-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Completing sign in...</p>
      </div>
    </div>
  );
}