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
import { AlertCircle, CheckCircle2, Settings, Wrench } from "lucide-react";
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

  // Count total available and unavailable providers
  const totalProviders = status.providers?.length ?? 0;
  const availableProviders = totalProviders - unavailableProviders.length;

  // If everything is ready, show a subtle success indicator
  if (unavailableProviders.length === 0 && !dockerNotReady && !gitNotReady) {
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
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full",
                  "bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30",
                  "text-emerald-700 dark:text-emerald-400",
                  "text-xs font-medium",
                  "shadow-sm backdrop-blur-sm"
                )}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>All systems ready</span>
                  <span className="text-emerald-600/70 dark:text-emerald-500/70 text-[10px] font-normal">
                    {totalProviders} providers
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium mb-1">Environment Status</p>
                <p className="text-xs opacity-90">All AI providers and development tools are properly configured and ready to use.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    );
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
          {/* Summary pill when there are issues */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate({ to: "/settings" })}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full",
                  "bg-slate-50/90 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-700/50",
                  "text-slate-700 dark:text-slate-300",
                  "text-xs font-medium",
                  "hover:bg-slate-100/90 dark:hover:bg-slate-800/60 transition-all duration-200",
                  "shadow-sm backdrop-blur-sm"
                )}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Setup required</span>
                <div className="flex items-center gap-1">
                  {availableProviders > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-normal">
                      {availableProviders} ready
                    </span>
                  )}
                  {unavailableProviders.length > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 text-[10px] font-normal">
                      {unavailableProviders.length} pending
                    </span>
                  )}
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-medium mb-1">Configuration Needed</p>
              <div className="text-xs space-y-1">
                {dockerNotReady && <p>• Docker needs to be running</p>}
                {gitNotReady && <p>• Git installation required</p>}
                {unavailableProviders.length > 0 && (
                  <p>• {unavailableProviders.length} AI provider{unavailableProviders.length > 1 ? 's' : ''} need setup</p>
                )}
                <p className="text-slate-500 dark:text-slate-400 mt-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                  Click to open settings
                </p>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Individual issue pills - only show critical ones */}
          {dockerNotReady && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate({ to: "/settings" })}
                  className={clsx(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                    "bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/50 dark:border-orange-800/30",
                    "text-orange-700 dark:text-orange-400",
                    "text-xs font-medium",
                    "hover:bg-orange-100/80 dark:hover:bg-orange-900/40 transition-all duration-200",
                    "shadow-sm backdrop-blur-sm"
                  )}
                >
                  <Wrench className="w-3 h-3" />
                  Docker
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">Docker Required</p>
                <p className="text-xs opacity-90">Start Docker to enable containerized development environments</p>
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
                    "bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/30",
                    "text-blue-700 dark:text-blue-400",
                    "text-xs font-medium",
                    "hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-all duration-200",
                    "shadow-sm backdrop-blur-sm"
                  )}
                >
                  <AlertCircle className="w-3 h-3" />
                  Git
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">Git Installation</p>
                <p className="text-xs opacity-90">Git is required for repository management and version control</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}
