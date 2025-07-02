import { Button } from "@/components/ui/button";
import { type Id } from "convex/_generated/dataModel";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface CreateTaskRunProps {
  taskId: Id<"tasks">;
  parentRunId?: Id<"taskRuns">;
  onComplete?: () => void;
  compact?: boolean;
}

export function CreateTaskRun({
  taskId,
  parentRunId,
  onComplete,
}: CreateTaskRunProps) {
  const [prompt, setPrompt] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    try {
      setIsExecuting(true);

      setPrompt("");
      onComplete?.();
    } catch (error) {
      console.error("Failed to execute task run:", error);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="prompt"
          className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
        >
          Task Run Prompt
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const form = e.currentTarget.closest("form");
              if (form) {
                form.requestSubmit();
              }
            }
          }}
          placeholder="Enter the prompt for Claude..."
          className="min-h-[100px] w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isExecuting}
        />
      </div>

      <Button
        type="submit"
        disabled={!prompt.trim() || isExecuting}
        className="w-full"
      >
        {isExecuting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Executing...
          </>
        ) : (
          "Create Task Run"
        )}
      </Button>
    </form>
  );
}
