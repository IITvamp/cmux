import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Command } from "lucide-react";

interface DashboardStartTaskButtonProps {
  canSubmit: boolean;
  onStartTask: () => void;
}

export function DashboardStartTaskButton({
  canSubmit,
  onStartTask,
}: DashboardStartTaskButtonProps) {
  const isMac = navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="default"
            className="!h-7 bg-orange-500 hover:bg-orange-600 text-white border-orange-500 dark:bg-orange-500 dark:hover:bg-orange-600"
            onClick={onStartTask}
            disabled={!canSubmit}
          >
            Start task
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="flex items-center gap-1 bg-black text-white border-black [&>*:last-child]:bg-black [&>*:last-child]:fill-black"
        >
          {isMac ? (
            <Command className="w-3 h-3" />
          ) : (
            <span className="text-xs">Ctrl</span>
          )}
          <span>+ Enter</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
