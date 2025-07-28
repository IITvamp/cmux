import { useSocket } from "@/contexts/socket/use-socket";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { GitBranch, Loader2 } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

interface AutoCommitPRButtonProps {
  workspacePath: string;
  projectFullName?: string;
  branch?: string;
  taskDescription: string;
}

export function AutoCommitPRButton({ 
  workspacePath, 
  projectFullName, 
  branch,
  taskDescription 
}: AutoCommitPRButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { socket } = useSocket();

  const handleAutoCommitPR = async () => {
    if (!socket || !workspacePath) {
      console.error("Socket not connected or workspace path missing");
      return;
    }

    setIsLoading(true);

    try {
      socket.emit("auto-commit-pr", {
        workspacePath,
        projectFullName,
        branch,
        taskDescription,
      }, (response) => {
        setIsLoading(false);
        
        if (response.success) {
          console.log("Auto-commit and PR created successfully:", response);
          // You could add a toast notification here
          if (response.prUrl) {
            // Open PR in new tab
            window.open(response.prUrl, "_blank");
          }
        } else {
          console.error("Auto-commit PR failed:", response.error);
          // You could add error toast notification here
        }
      });
    } catch (error) {
      setIsLoading(false);
      console.error("Error during auto-commit PR:", error);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleAutoCommitPR}
            disabled={isLoading}
            className={clsx(
              "p-1 rounded transition-colors",
              "bg-neutral-100 dark:bg-neutral-700",
              isLoading 
                ? "text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <GitBranch className="w-3.5 h-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isLoading ? "Creating commit & PR..." : "Auto-commit & create PR"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}