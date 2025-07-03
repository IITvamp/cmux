import AntdMultiSelect from "@/components/AntdMultiSelect";
import LexicalEditor from "@/components/lexical/LexicalEditor";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSocket } from "@/contexts/socket/use-socket";
import type { TaskError, TaskStarted } from "@/shared/socket-schemas";
import { type Repo } from "@/types/task";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { api } from "convex-gen/api";
import { useAction } from "convex/react";
import { Command, Loader2, Mic } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/_layout/dashboard")({
  component: DashboardComponent,
});

function DashboardComponent() {
  const [selectedProject, setSelectedProject] = useState<string[]>(() => {
    const stored = localStorage.getItem("selectedProject");
    return stored ? JSON.parse(stored) : [];
  });
  const [selectedBranch, setSelectedBranch] = useState<string[]>([]);
  const [selectedFanout, setSelectedFanout] = useState<string[]>(["1x"]);
  const [taskDescription, setTaskDescription] = useState<string>("");
  const [isStartingTask, setIsStartingTask] = useState(false);

  // Callback for task description changes
  const handleTaskDescriptionChange = useCallback((value: string) => {
    setTaskDescription(value);
  }, []);

  // Callback for project selection changes
  const handleProjectChange = useCallback(
    (newProjects: string[]) => {
      setSelectedProject(newProjects);
      localStorage.setItem("selectedProject", JSON.stringify(newProjects));
      if (newProjects[0] !== selectedProject[0]) {
        setSelectedBranch([]);
      }
    },
    [selectedProject]
  );

  // Callback for branch selection changes
  const handleBranchChange = useCallback((newBranches: string[]) => {
    setSelectedBranch(newBranches);
  }, []);

  // Callback for fanout selection changes
  const handleFanoutChange = useCallback((newFanout: string[]) => {
    setSelectedFanout(newFanout);
  }, []);

  // Fetch repos grouped by org
  const reposQuery = useQuery(convexQuery(api.github.getReposByOrg, {}));

  // Fetch branches for selected repo
  const branchesQuery = useQuery({
    ...convexQuery(api.github.getBranches, {
      repo: selectedProject[0] || "",
    }),
    enabled: !!selectedProject[0],
  });

  // Actions to fetch data from GitHub
  const fetchRepos = useAction(api.githubActions.fetchAndStoreRepos);
  const fetchBranches = useAction(api.githubActions.fetchBranches);
  
  // Get socket connection
  const { socket } = useSocket();

  const handleStartTask = useCallback(async () => {
    if (!selectedProject[0] || !taskDescription.trim()) {
      console.error("Please select a project and enter a task description");
      return;
    }

    const repoUrl = `https://github.com/${selectedProject[0]}.git`;
    const branch = selectedBranch[0] || "main";

    setIsStartingTask(true);
    try {
      // Emit Socket.IO event to start task with acknowledgement
      socket?.emit("start-task", {
        repoUrl,
        branch,
        taskDescription,
        projectFullName: selectedProject[0],
      }, (response: TaskStarted | TaskError) => {
        setIsStartingTask(false);
        
        if ("error" in response) {
          console.error("Task error:", response.error);
        } else {
          console.log("Task started:", response);
          // Navigate to terminal view or handle task started
        }
      });
    } catch (error) {
      console.error("Error starting task:", error);
      setIsStartingTask(false);
    }
  }, [selectedProject, taskDescription, selectedBranch, socket]);

  // Fetch repos on mount if none exist
  useEffect(() => {
    if (reposQuery.data && Object.keys(reposQuery.data).length === 0) {
      fetchRepos();
    }
  }, [reposQuery.data, fetchRepos]);

  // Fetch branches when repo changes
  const selectedRepo = selectedProject[0];
  useEffect(() => {
    if (selectedRepo && branchesQuery.data?.length === 0) {
      fetchBranches({ repo: selectedRepo });
    }
  }, [selectedRepo, branchesQuery.data, fetchBranches]);

  // Format repos for multiselect
  const projectOptions = Object.entries(reposQuery.data || {}).flatMap(
    ([, repos]: [string, Repo[]]) => repos.map((repo: Repo) => repo.fullName)
  );

  const branchOptions = branchesQuery.data || [];

  // Derive effective selected branch - if nothing selected, auto-select a sensible default
  const effectiveSelectedBranch =
    selectedBranch.length > 0
      ? selectedBranch
      : branchesQuery.data && branchesQuery.data.length > 0
        ? [
            branchesQuery.data.includes("main")
              ? "main"
              : branchesQuery.data.includes("master")
                ? "master"
                : branchesQuery.data[0],
          ]
        : [];

  const fanoutOptions = ["1x", "2x", "3x", "5x"];

  // Detect operating system for keyboard shortcut display
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shortcutKey = isMac ? "⌘" : "Ctrl";

  // Handle Command+Enter keyboard shortcut
  const handleSubmit = useCallback(() => {
    if (selectedProject[0] && taskDescription.trim() && !isStartingTask) {
      handleStartTask();
    }
  }, [selectedProject, taskDescription, isStartingTask, handleStartTask]);

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-900/60">
      {/* Main content area */}
      <div className="flex-1 flex justify-center px-8 pt-60">
        <div className="w-full max-w-4xl">
          <div
            className={clsx(
              "relative bg-white dark:bg-neutral-700/50 border border-neutral-200 dark:border-neutral-500/15 rounded-2xl transition-all"
            )}
          >
            <LexicalEditor
              placeholder="Describe a task"
              onChange={handleTaskDescriptionChange}
              onSubmit={handleSubmit}
              padding={{
                paddingLeft: "14px",
                paddingRight: "16px",
                paddingTop: "14px",
              }}
              contentEditableClassName={clsx(
                "text-[15px] text-neutral-900 dark:text-neutral-100 min-h-[60px]! max-h-[600px]",
                "focus:outline-none"
              )}
            />

            {/* Integrated controls */}
            <div className="flex items-end justify-between p-2">
              <div className="flex items-end gap-1">
                <AntdMultiSelect
                  options={projectOptions}
                  value={selectedProject}
                  onChange={handleProjectChange}
                  placeholder="Select project..."
                  className="!min-w-[300px] !max-w-[500px] !rounded-2xl"
                  loading={reposQuery.isLoading}
                  // singleSelect={true}
                  // className={clsx(
                  //   "!border !border-neutral-200 dark:!border-0",
                  //   "bg-neutral-100 dark:bg-neutral-700 dark:hover:bg-neutral-600/90 aria-expanded:bg-neutral-600/90 transition",
                  //   "!h-7 text-[13px] font-medium",
                  //   "!text-neutral-700 dark:!text-neutral-300",
                  //   "!min-w-[200px]"
                  // )}
                />

                <AntdMultiSelect
                  options={branchOptions}
                  value={effectiveSelectedBranch}
                  onChange={handleBranchChange}
                  placeholder="Select branch..."
                  singleSelect={true}
                  className="!min-w-[120px] !rounded-2xl"
                  loading={branchesQuery.isLoading}
                  // className={clsx(
                  //   "!border !border-neutral-200 dark:!border-0",
                  //   "bg-neutral-100 dark:bg-neutral-700 dark:hover:bg-neutral-600/90 aria-expanded:bg-neutral-600/90 transition",
                  //   "!h-7 text-[13px] font-medium",
                  //   "!text-neutral-700 dark:!text-neutral-300"
                  //   // "!min-w-[120px]"
                  // )}
                />

                <AntdMultiSelect
                  options={fanoutOptions}
                  value={selectedFanout}
                  onChange={handleFanoutChange}
                  placeholder="Fanout..."
                  singleSelect={true}
                  className="!min-w-[120px] !rounded-2xl"
                  // className={clsx(
                  //   "!border !border-neutral-200 dark:!border-0",
                  //   "bg-neutral-100 dark:bg-neutral-700 dark:hover:bg-neutral-600/90 aria-expanded:bg-neutral-600/90 transition",
                  //   "!h-7 text-[13px] font-medium",
                  //   "!text-neutral-700 dark:!text-neutral-300"
                  //   // "!min-w-[60px]"
                  // )}
                />
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  className={clsx(
                    "p-1.5 rounded-full",
                    "bg-neutral-100 dark:bg-neutral-700",
                    "border border-neutral-200 dark:border-0",
                    "text-neutral-600 dark:text-neutral-400",
                    "hover:bg-neutral-200 dark:hover:bg-neutral-600",
                    "transition-colors"
                  )}
                >
                  <Mic className="w-4 h-4" />
                </button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="default"
                        className="!h-7"
                        onClick={handleStartTask}
                        disabled={
                          isStartingTask ||
                          !selectedProject[0] ||
                          !taskDescription.trim()
                        }
                      >
                        {isStartingTask ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          "Start task"
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="flex items-center gap-1 bg-black text-white border-black [&>*:last-child]:bg-black [&>*:last-child]:fill-black"
                      style={{ "--primary": "black" } as React.CSSProperties}
                    >
                      {isMac ? (
                        <Command className="w-3 h-3" />
                      ) : (
                        <span className="text-xs">{shortcutKey}</span>
                      )}
                      <span>Enter</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
