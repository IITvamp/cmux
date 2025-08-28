import { toast } from "sonner";

export class UpdateNotification {
  private static updateToastId: string | number | null = null;

  static showUpdateAvailable() {
    if (this.updateToastId) {
      toast.dismiss(this.updateToastId);
    }

    this.updateToastId = toast("Update Available", {
      description:
        "A new version of Cmux is available and will be downloaded in the background.",
      duration: 5000,
    });
  }

  static showUpdateDownloaded() {
    if (this.updateToastId) {
      toast.dismiss(this.updateToastId);
    }

    this.updateToastId = toast("Update Ready", {
      description:
        "Update downloaded. Restart the application to apply the update.",
      action: {
        label: "Restart",
        onClick: () => {
          // This will be handled by the main process
          window.electronAPI?.restartApp?.();
        },
      },
      duration: 10000,
    });
  }

  static showUpdateError(error: string) {
    if (this.updateToastId) {
      toast.dismiss(this.updateToastId);
    }

    this.updateToastId = toast.error("Update Failed", {
      description: `Failed to check for updates: ${error}`,
      duration: 5000,
    });
  }
}
