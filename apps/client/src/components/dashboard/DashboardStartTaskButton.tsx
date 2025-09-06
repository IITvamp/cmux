import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="default"
          className="!h-7"
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
  );
}
