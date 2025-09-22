import { useSocketContext } from "@/lib/socket-context";
import { cn } from "@/lib/utils";
import { api } from "@cmux/convex/api";
import { useMutation } from "convex/react";
import { MessageSquare, Sparkles } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { useState, useRef, KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

interface TaskCommentInputProps {
  originalPrompt: string;
  taskId: string;
  teamSlugOrId: string;
  projectFullName: string;
  selectedAgents?: string[];
  className?: string;
}

export function TaskCommentInput({
  originalPrompt,
  taskId,
  teamSlugOrId,
  projectFullName,
  selectedAgents,
  className,
}: TaskCommentInputProps) {
  const [comment, setComment] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { socket } = useSocketContext();
  const createTask = useMutation(api.tasks.create);

  const handleStartNewTask = async () => {
    if (!comment.trim() || !socket) return;

    try {
      setIsStarting(true);

      // Concatenate original prompt with the follow-up comment
      const concatenatedPrompt = `${originalPrompt}\n\nFollow-up context:\n${comment.trim()}`;

      // Create a new task with the concatenated prompt
      const newTaskId = await createTask({
        teamSlugOrId,
        text: concatenatedPrompt,
        projectFullName,
      });

      // Start the task with agents
      socket.emit(
        "start-task",
        {
          taskDescription: concatenatedPrompt,
          projectFullName,
          taskId: newTaskId,
          selectedAgents: selectedAgents || ["claude/sonnet-4"],
          isCloudMode: true,
        },
        (response: any) => {
          if (response.success) {
            toast.success("New task started with follow-up context");
            // Navigate to the new task
            router.navigate({
              to: "/$teamSlugOrId/task/$taskId",
              params: {
                teamSlugOrId,
                taskId: newTaskId,
              },
            });
          } else {
            toast.error(response.error || "Failed to start task");
            setIsStarting(false);
          }
        }
      );

      // Clear the comment after successful submission
      setComment("");
      setIsExpanded(false);
    } catch (error) {
      console.error("Error starting new task:", error);
      toast.error("Failed to start new task");
      setIsStarting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleStartNewTask();
    }
  };

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleBlur = () => {
    if (!comment.trim()) {
      setIsExpanded(false);
    }
  };

  return (
    <div
      className={cn(
        "border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900",
        "transition-all duration-200",
        className
      )}
    >
      <div className="px-3 py-2">
        <div className="flex items-start gap-2">
          <MessageSquare className="w-4 h-4 mt-2 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Add follow-up context to restart this task..."
              className={cn(
                "resize-none bg-transparent border-0 focus:ring-0 p-0 min-h-[32px]",
                "text-sm text-neutral-700 dark:text-neutral-300",
                "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
                "transition-all duration-200",
                isExpanded ? "h-20" : "h-8"
              )}
              disabled={isStarting}
            />
            {(isExpanded || comment.trim()) && (
              <div className="flex items-center justify-between mt-2 animate-in fade-in-50 duration-200">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  <kbd className="px-1 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700">
                    {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter
                  </kbd>{" "}
                  to start new task with context
                </div>
                <Button
                  onClick={handleStartNewTask}
                  disabled={!comment.trim() || isStarting}
                  size="sm"
                  className="h-7 text-xs"
                >
                  {isStarting ? (
                    <>
                      <Sparkles className="w-3 h-3 mr-1 animate-pulse" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      Start with context
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}