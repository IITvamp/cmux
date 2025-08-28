"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function AppLoginPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const refreshToken = searchParams.get("refresh_token");
    const error = searchParams.get("error");
    
    if (error) {
      console.error("Authentication error:", error);
      return;
    }
    
    if (refreshToken) {
      const electronAppUrl = `cmux://auth-callback?refresh_token=${encodeURIComponent(refreshToken)}`;
      
      window.location.href = electronAppUrl;
      
      setTimeout(() => {
        const fallbackMessage = document.getElementById("fallback-message");
        if (fallbackMessage) {
          fallbackMessage.style.display = "block";
        }
      }, 2000);
    }
  }, [searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-neutral-50 dark:bg-neutral-900">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Authenticating...
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Redirecting to cmux app...
        </p>
        
        <div id="fallback-message" className="hidden space-y-4 mt-8">
          <p className="text-neutral-600 dark:text-neutral-400">
            If the app didn't open automatically, you can:
          </p>
          <button
            onClick={() => {
              const refreshToken = searchParams.get("refresh_token");
              if (refreshToken) {
                window.location.href = `cmux://auth-callback?refresh_token=${encodeURIComponent(refreshToken)}`;
              }
            }}
            className="px-4 py-2 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-md hover:opacity-80 transition"
          >
            Open cmux App
          </button>
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            Or copy the token and paste it in the app manually.
          </p>
        </div>
        
        {searchParams.get("error") && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-600 dark:text-red-400">
              Authentication failed: {searchParams.get("error")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}