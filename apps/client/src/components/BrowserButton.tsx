import { Monitor } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

interface BrowserButtonProps {
  vncPort?: string | null;
  provider?: "docker" | "morph" | "daytona" | "other" | null;
  classNameButton?: string;
}

export function BrowserButton({
  vncPort,
  provider,
  classNameButton,
}: BrowserButtonProps) {
  const isCloudMode = provider === "morph" || provider === "daytona";

  const handleOpenBrowser = useCallback(() => {
    if (!vncPort) {
      toast.error("VNC port not available");
      return;
    }

    try {
      // Extract the base URL from the VNC port
      // Format: https://port-39380-morphvm-{id}.http.cloud.morph.so
      const url = new URL(vncPort);

      // Add VNC.html path and query parameters for auto-connect and local scaling
      url.pathname = "/vnc.html";
      url.searchParams.set("autoconnect", "true");
      url.searchParams.set("resize", "scale");

      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to open browser:", error);
      toast.error("Failed to open browser");
    }
  }, [vncPort]);

  // Only show button for cloud/morph instances
  if (!isCloudMode || !vncPort) {
    return null;
  }

  return (
    <button
      onClick={handleOpenBrowser}
      className={
        classNameButton ||
        "flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-white rounded hover:bg-neutral-700 font-medium text-xs select-none whitespace-nowrap border border-neutral-700"
      }
      title="Open browser in VNC"
    >
      <Monitor className="w-3.5 h-3.5" />
      Browser
    </button>
  );
}
