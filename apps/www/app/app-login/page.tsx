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
        // Get OAuth parameters from URL
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (error) {
          throw new Error(errorDescription || error);
        }

        if (!code) {
          throw new Error("No authorization code received");
        }

        // Exchange code for tokens using StackAuth
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
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `HTTP ${response.status}: Failed to exchange authorization code`,
          );
        }

        const data = await response.json();
        if (!data.refreshToken) {
          throw new Error("No refresh token received from server");
        }

        const { refreshToken } = data;

        // Open electron app with custom URL scheme
        const electronUrl = `cmux://auth/callback?refreshToken=${encodeURIComponent(refreshToken)}`;
        window.location.href = electronUrl;

        setStatus("success");
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setStatus("error");
      }
    };

    handleOAuthCallback();
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg">Completing authentication...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Authentication Failed</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-green-600 text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2">Authentication Successful</h1>
        <p className="text-gray-600">Redirecting to cmux...</p>
      </div>
    </div>
  );
}
