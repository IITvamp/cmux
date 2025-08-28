import { useEffect } from "react";

export function useElectronAuthCallback() {
  useEffect(() => {
    const api = (window as any).api;
    if (!api?.onAuthCallback) {
      return;
    }

    const handleAuthCallback = async (data: { refreshToken: string }) => {
      try {
        document.cookie = `stack-refresh-token=${data.refreshToken}; path=/; max-age=31536000; samesite=strict`;
        
        window.location.reload();
      } catch (error) {
        console.error("Failed to set refresh token:", error);
      }
    };

    api.onAuthCallback(handleAuthCallback);

    return () => {
      api.removeAuthCallbackListener?.();
    };
  }, []);
}