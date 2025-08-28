"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AppLoginPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get the authorization code from URL parameters
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        if (!code) {
          setError("No authorization code received");
          setStatus("error");
          return;
        }

        // Exchange the authorization code for tokens
        const response = await fetch("/api/auth/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            state,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to exchange authorization code");
        }

        const data = await response.json();
        const { refreshToken } = data;

        if (!refreshToken) {
          throw new Error("No refresh token received");
        }

        // Redirect to electron app with the refresh token
        // Using cmux:// protocol which should be registered by the electron app
        const redirectUrl = `cmux://auth/callback?refreshToken=${encodeURIComponent(refreshToken)}&state=${encodeURIComponent(state || "")}`;

        // Redirect to the electron app
        window.location.href = redirectUrl;

        setStatus("success");
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        setStatus("error");
      }
    };

    handleOAuthCallback();
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 dark:border-neutral-100 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">
            Completing authentication...
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            Authentication Error
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">{error}</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
      <div className="text-center">
        <div className="text-green-500 text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          Authentication Successful
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Redirecting back to the application...
        </p>
      </div>
    </div>
  );
}
