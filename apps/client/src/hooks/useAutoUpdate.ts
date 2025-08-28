import { useEffect } from "react";
import { UpdateNotification } from "../components/UpdateNotification";

export function useAutoUpdate() {
  useEffect(() => {
    // Listen for update events from main process
    const handleUpdateAvailable = () => {
      UpdateNotification.showUpdateAvailable();
    };

    const handleUpdateDownloaded = () => {
      UpdateNotification.showUpdateDownloaded();
    };

    const handleUpdateError = (_event: any, error: string) => {
      UpdateNotification.showUpdateError(error);
    };

    // Add event listeners
    window.electronAPI?.on?.("update-available", handleUpdateAvailable);
    window.electronAPI?.on?.("update-downloaded", handleUpdateDownloaded);
    window.electronAPI?.on?.("update-error", handleUpdateError);

    // Cleanup
    return () => {
      window.electronAPI?.removeListener?.(
        "update-available",
        handleUpdateAvailable,
      );
      window.electronAPI?.removeListener?.(
        "update-downloaded",
        handleUpdateDownloaded,
      );
      window.electronAPI?.removeListener?.("update-error", handleUpdateError);
    };
  }, []);
}
