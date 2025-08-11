import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type MergeMethod = "squash" | "merge" | "rebase";

interface MergeButtonProps {
  onMerge: (method: MergeMethod) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

const mergeMethodLabels: Record<MergeMethod, string> = {
  squash: "Squash and merge",
  merge: "Create a merge commit",
  rebase: "Rebase and merge",
};

export function MergeButton({
  onMerge,
  disabled = false,
  loading = false,
  className,
}: MergeButtonProps) {
  const [mergeMethod, setMergeMethod] = useState<MergeMethod>("squash");

  const handleMerge = () => {
    onMerge(mergeMethod);
  };

  const handleMethodChange = (method: MergeMethod) => {
    setMergeMethod(method);
  };

  return (
    <div className={cn("flex", className)}>
      <Button
        onClick={handleMerge}
        disabled={disabled || loading}
        className="rounded-r-none bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white border-r border-green-700 dark:border-green-700"
      >
        {loading ? "Merging..." : mergeMethodLabels[mergeMethod]}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={disabled || loading}
            className="rounded-l-none px-2 bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(Object.keys(mergeMethodLabels) as MergeMethod[]).map((method) => (
            <DropdownMenuItem
              key={method}
              onClick={() => handleMethodChange(method)}
              className={cn(
                "cursor-pointer",
                method === mergeMethod && "bg-neutral-100 dark:bg-neutral-800"
              )}
            >
              {mergeMethodLabels[method]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}