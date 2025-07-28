import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSocket } from "@/contexts/socket/use-socket";
import type { ProviderStatus, ProviderStatusResponse } from "@cmux/shared";
import { useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function ProviderStatusPills() {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ProviderStatusResponse | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const checkProviderStatus = useCallback(() => {
    if (!socket) return;

    socket.emit("check-provider-status", (response) => {
      if (response.success) {
        setStatus(response);
        // Delay visibility to create fade-in effect
        setTimeout(() => setIsVisible(true), 100);
      }
    });
  }, [socket]);

  // Check status on mount and every 30 seconds
  useEffect(() => {
    checkProviderStatus();
    const interval = setInterval(checkProviderStatus, 30000);
    return () => clearInterval(interval);
  }, [checkProviderStatus]);

  if (!status) return null;

  // Get providers that are not available
  const unavailableProviders =
    status.providers?.filter((p: ProviderStatus) => !p.isAvailable) ?? [];

  const dockerNotReady = !status.dockerStatus?.isRunning;
  const gitNotReady = !status.gitStatus?.isAvailable;

  // If everything is ready, don't show anything
  if (unavailableProviders.length === 0 && !dockerNotReady && !gitNotReady) {
    return null;
  }

  return (
    <div
      className={clsx(
        "absolute left-0 right-0 -top-9 flex justify-center pointer-events-none z-10",
        "transition-all duration-500 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      )}
    >
      <TooltipProvider>
        <div className="flex items-center gap-2 pointer-events-auto">
          {dockerNotReady && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate({ to: "/settings" })}
                  className={clsx(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                    "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
                    "text-xs font-medium",
                    "hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors",
                    "animate-pulse-subtle"
                  )}
                >
                  <AlertCircle className="w-3 h-3" />
                  Docker
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Docker is not running</p>
              </TooltipContent>
            </Tooltip>
          )}

          {gitNotReady && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate({ to: "/settings" })}
                  className={clsx(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
                    "text-xs font-medium",
                    "hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors",
                    "animate-pulse-subtle"
                  )}
                >
                  <AlertCircle className="w-3 h-3" />
                  Git
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Git is not installed</p>
              </TooltipContent>
            </Tooltip>
          )}

          {unavailableProviders.map((provider: ProviderStatus) => (
            <Tooltip key={provider.name}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate({ to: "/settings" })}
                  className={clsx(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                    "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
                    "text-xs font-medium",
                    "hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors",
                    "animate-pulse-subtle"
                  )}
                >
                  <AlertCircle className="w-3 h-3" />
                  {provider.name}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{provider.name} is not set up properly</p>
                {provider.missingRequirements &&
                  provider.missingRequirements.length === 1 && (
                    <p className="text-xs opacity-80">
                      Missing: {provider.missingRequirements[0]}
                    </p>
                  )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
