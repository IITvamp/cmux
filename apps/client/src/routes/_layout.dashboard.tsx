import AntdMultiSelect from "@/components/AntdMultiSelect";
import LexicalEditor from "@/components/lexical/LexicalEditor";
import { Button } from "@/components/ui/button";
import { ModeToggleTooltip } from "@/components/ui/mode-toggle-tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSocket } from "@/contexts/socket/use-socket";
import { createFakeConvexId } from "@/lib/fakeConvexId";
import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { AGENT_CONFIGS } from "@cmux/shared/agentConfig";
import { convexQuery } from "@convex-dev/react-query";
import { useClipboard } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import {
  Archive,
  Check,
  Code2,
  Command,
  Copy,
  Image,
  Mic,
  Pin,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/_layout/dashboard")({
  component: DashboardComponent,
});

function DashboardComponent() {
  const { socket } = useSocket();

  const [selectedProject, setSelectedProject] = useState<string[]>(() => {
    const stored = localStorage.getItem("selectedProject");
    return stored ? JSON.parse(stored) : [];
  });
  const [selectedBranch, setSelectedBranch] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>(() => {
    const stored = localStorage.getItem("selectedAgents");
    return stored ? JSON.parse(stored) : ["claude-sonnet"];
  });
  const [taskDescription, setTaskDescription] = useState<string>("");
  const [isCloudMode, setIsCloudMode] = useState<boolean>(() => {
    const stored = localStorage.getItem("isCloudMode");
    return stored ? JSON.parse(stored) : false;
  });

  // State for loading states
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  // Define editor API interface
  interface EditorApi {
    getContent: () => {
      text: string;
      images: Array<{
        src: string;
        fileName?: string;
        altText: string;
      }>;
    };
    clear: () => void;
  }

  // Ref to access editor API
  const editorApiRef = useRef<EditorApi | null>(null);

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

  // Callback for agent selection changes
  const handleAgentChange = useCallback((newAgents: string[]) => {
    setSelectedAgents(newAgents);
    localStorage.setItem("selectedAgents", JSON.stringify(newAgents));
  }, []);

  // Fetch tasks for all projects
  const tasksQuery = useQuery(convexQuery(api.tasks.get, {}));

  // Fetch repos from Convex
  const reposByOrgQuery = useQuery(convexQuery(api.github.getReposByOrg, {}));
  const reposByOrg = reposByOrgQuery.data || {};

  // Fetch branches for selected repo from Convex
  const branchesQuery = useQuery({
    ...convexQuery(api.github.getBranches, { repo: selectedProject[0] || "" }),
    enabled: !!selectedProject[0],
  });
  const branches = branchesQuery.data || [];

  // Socket-based functions to fetch data from GitHub
  const fetchRepos = useCallback(() => {
    if (!socket) return;

    setIsLoadingRepos(true);
    socket.emit("github-fetch-repos", (response) => {
      setIsLoadingRepos(false);
      if (response.success) {
        // Refetch from Convex to get updated data
        reposByOrgQuery.refetch();
      } else if (response.error) {
        console.error("Error fetching repos:", response.error);
      }
    });
  }, [socket, reposByOrgQuery]);

  const fetchBranches = useCallback(
    (repo: string) => {
      if (!socket) return;

      setIsLoadingBranches(true);
      socket.emit("github-fetch-branches", { repo }, (response) => {
        setIsLoadingBranches(false);
        if (response.success) {
          // Refetch from Convex to get updated data
          branchesQuery.refetch();
        } else if (response.error) {
          console.error("Error fetching branches:", response.error);
        }
      });
    },
    [socket, branchesQuery]
  );

  // Mutation to create tasks with optimistic update
  const createTask = useMutation(api.tasks.create).withOptimisticUpdate(
    (localStore, args) => {
      const currentTasks = localStore.getQuery(api.tasks.get, {});

      if (currentTasks !== undefined) {
        const now = Date.now();
        const optimisticTask = {
          _id: createFakeConvexId() as Doc<"tasks">["_id"],
          _creationTime: now,
          text: args.text,
          description: args.description,
          projectFullName: args.projectFullName,
          branch: args.branch,
          worktreePath: args.worktreePath,
          isCompleted: false,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
          images: args.images,
        };

        // Add the new task at the beginning (since we order by desc)
        localStore.setQuery(api.tasks.get, {}, [
          optimisticTask,
          ...currentTasks,
        ]);
      }
    }
  );

  const archiveTask = useMutation(api.tasks.archive);

  // Add mutation for generating upload URL
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  const handleStartTask = useCallback(async () => {
    if (!selectedProject[0] || !taskDescription.trim()) {
      console.error("Please select a project and enter a task description");
      return;
    }
    if (!socket) {
      console.error("Socket not connected");
      return;
    }

    const branch = selectedBranch[0] || undefined;
    const projectFullName = selectedProject[0];
    if (!projectFullName) {
      console.error("Please select a project");
      return;
    }

    try {
      // Extract content including images from the editor
      const content = editorApiRef.current?.getContent();
      const images = content?.images || [];

      // Upload images to Convex storage first
      const uploadedImages = await Promise.all(
        images.map(
          async (image: {
            src: string;
            fileName?: string;
            altText: string;
          }) => {
            // Convert base64 to blob
            const base64Data = image.src.split(",")[1] || image.src;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: "image/png" });

            // Get upload URL
            const uploadUrl = await generateUploadUrl();

            // Upload the file
            const result = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": blob.type },
              body: blob,
            });
            const { storageId } = await result.json();

            return {
              storageId,
              fileName: image.fileName,
              altText: image.altText,
            };
          }
        )
      );

      console.log("content?.text", content?.text);

      // Create task in Convex with storage IDs
      const taskId = await createTask({
        text: content?.text || taskDescription, // Use content.text which includes image references
        projectFullName,
        branch,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
      });

      // Clear input after successful task creation
      setTaskDescription("");
      // Force editor to clear
      handleTaskDescriptionChange("");
      if (editorApiRef.current?.clear) {
        editorApiRef.current.clear();
      }

      const repoUrl = `https://github.com/${projectFullName}.git`;

      // For socket.io, we need to send the content text (which includes image references) and the images
      socket.emit(
        "start-task",
        {
          repoUrl,
          branch,
          taskDescription: content?.text || taskDescription, // Use content.text which includes image references
          projectFullName,
          taskId,
          selectedAgents:
            selectedAgents.length > 0 ? selectedAgents : undefined,
          isCloudMode,
          images: images.length > 0 ? images : undefined,
        },
        (response) => {
          console.log("response", response);
          if ("error" in response) {
            console.error("Task start error:", response.error);
          } else {
            console.log("Task started:", response);
          }
        }
      );
      console.log("Task created:", taskId);
    } catch (error) {
      console.error("Error starting task:", error);
    }
  }, [
    selectedProject,
    taskDescription,
    socket,
    selectedBranch,
    createTask,
    handleTaskDescriptionChange,
    selectedAgents,
    isCloudMode,
    generateUploadUrl,
  ]);

  // Fetch repos on mount if none exist
  // useEffect(() => {
  //   if (Object.keys(reposByOrg).length === 0) {
  //     fetchRepos();
  //   }
  // }, [reposByOrg, fetchRepos]);

  // Fetch branches when repo changes
  const selectedRepo = selectedProject[0];
  useEffect(() => {
    if (selectedRepo && branches.length === 0) {
      fetchBranches(selectedRepo);
    }
  }, [selectedRepo, branches, fetchBranches]);

  // Format repos for multiselect
  const projectOptions = Object.entries(reposByOrg || {}).flatMap(([, repos]) =>
    repos.map((repo) => repo.fullName)
  );

  const branchOptions = branches || [];

  // Derive effective selected branch - if nothing selected, auto-select a sensible default
  const effectiveSelectedBranch =
    selectedBranch.length > 0
      ? selectedBranch
      : branches && branches.length > 0
        ? [
            branches.includes("main")
              ? "main"
              : branches.includes("master")
                ? "master"
                : branches[0],
          ]
        : [];

  const agentOptions = AGENT_CONFIGS.map((agent) => agent.name);

  const navigate = useNavigate();

  // Listen for VSCode spawned events
  useEffect(() => {
    if (!socket) return;

    const handleVSCodeSpawned = (data: {
      instanceId: string;
      url: string;
      workspaceUrl: string;
      provider: string;
    }) => {
      console.log("VSCode spawned:", data);
      // Open in new tab
      // window.open(data.workspaceUrl, "_blank");
    };

    socket.on("vscode-spawned", handleVSCodeSpawned);

    return () => {
      socket.off("vscode-spawned", handleVSCodeSpawned);
    };
  }, [socket]);

  // Detect operating system for keyboard shortcut display
  const isMac = navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
  const shortcutKey = isMac ? "⌘" : "Ctrl";

  // Handle Command+Enter keyboard shortcut
  const handleSubmit = useCallback(() => {
    if (selectedProject[0] && taskDescription.trim()) {
      handleStartTask();
    }
  }, [selectedProject, taskDescription, handleStartTask]);

  // Memoize individual LexicalEditor props to prevent unnecessary re-renders
  const lexicalPlaceholder = useMemo(() => "Describe a task", []);

  const lexicalRepoUrl = useMemo(
    () =>
      selectedProject[0]
        ? `https://github.com/${selectedProject[0]}.git`
        : undefined,
    [selectedProject]
  );

  const lexicalBranch = useMemo(
    () => effectiveSelectedBranch[0],
    [effectiveSelectedBranch]
  );

  const lexicalPadding = useMemo(
    () => ({
      paddingLeft: "14px",
      paddingRight: "16px",
      paddingTop: "14px",
    }),
    []
  );

  const lexicalClassName = useMemo(
    () =>
      clsx(
        "text-[15px] text-neutral-900 dark:text-neutral-100 min-h-[60px]! max-h-[600px]",
        "focus:outline-none"
      ),
    []
  );

  const lexicalOnEditorReady = useMemo(
    () => (api: EditorApi) => {
      editorApiRef.current = api;
    },
    []
  );

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-900/60 overflow-y-auto">
      {/* Main content area */}
      <div className="flex-1 flex justify-center px-4 pt-60 pb-4">
        <div className="w-full max-w-4xl">
          <div
            className={clsx(
              "relative bg-white dark:bg-neutral-700/50 border border-neutral-200 dark:border-neutral-500/15 rounded-2xl transition-all"
            )}
          >
            <LexicalEditor
              placeholder={lexicalPlaceholder}
              onChange={handleTaskDescriptionChange}
              onSubmit={handleSubmit}
              repoUrl={lexicalRepoUrl}
              branch={lexicalBranch}
              padding={lexicalPadding}
              contentEditableClassName={lexicalClassName}
              onEditorReady={lexicalOnEditorReady}
            />

            {/* Integrated controls */}
            <div className="flex items-end justify-between p-2 gap-1">
              <div className="flex items-end gap-1">
                <AntdMultiSelect
                  options={projectOptions}
                  value={selectedProject}
                  onChange={handleProjectChange}
                  placeholder="Select project..."
                  className="!min-w-[300px] !max-w-[500px] !rounded-2xl"
                  loading={isLoadingRepos || reposByOrgQuery.isLoading}
                  maxTagCount={1}
                  showSearch
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
                  loading={isLoadingBranches || branchesQuery.isLoading}
                  showSearch
                  // className={clsx(
                  //   "!border !border-neutral-200 dark:!border-0",
                  //   "bg-neutral-100 dark:bg-neutral-700 dark:hover:bg-neutral-600/90 aria-expanded:bg-neutral-600/90 transition",
                  //   "!h-7 text-[13px] font-medium",
                  //   "!text-neutral-700 dark:!text-neutral-300"
                  //   // "!min-w-[120px]"
                  // )}
                />

                <AntdMultiSelect
                  options={agentOptions}
                  value={selectedAgents}
                  onChange={handleAgentChange}
                  placeholder="Select agents..."
                  singleSelect={false}
                  maxTagCount={1}
                  className="!min-w-[200px] !rounded-2xl"
                  showSearch
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
                {/* Cloud/Local Mode Toggle */}
                <ModeToggleTooltip
                  isCloudMode={isCloudMode}
                  onToggle={() => {
                    const newMode = !isCloudMode;
                    setIsCloudMode(newMode);
                    localStorage.setItem(
                      "isCloudMode",
                      JSON.stringify(newMode)
                    );
                  }}
                />

                <button
                  className={clsx(
                    "p-1.5 rounded-full",
                    "bg-neutral-100 dark:bg-neutral-700",
                    "border border-neutral-200 dark:border-0",
                    "text-neutral-600 dark:text-neutral-400",
                    "hover:bg-neutral-200 dark:hover:bg-neutral-600",
                    "transition-colors"
                  )}
                  onClick={() => {
                    // Trigger the file select from ImagePlugin
                    const lexicalWindow = window as Window & {
                      __lexicalImageFileSelect?: () => void;
                    };
                    if (lexicalWindow.__lexicalImageFileSelect) {
                      lexicalWindow.__lexicalImageFileSelect();
                    }
                  }}
                  title="Upload image"
                >
                  <Image className="w-4 h-4" />
                </button>

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
                        <span className="text-xs">{shortcutKey}</span>
                      )}
                      <span>+ Enter</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Task List */}
          {tasksQuery.data && tasksQuery.data.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2 select-none">
                All Tasks
              </h2>
              <div className="space-y-1">
                {tasksQuery.data.map((task: Doc<"tasks">) => (
                  <TaskItem
                    key={task._id}
                    task={task}
                    navigate={navigate}
                    archiveTask={archiveTask}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TaskItemProps {
  task: Doc<"tasks">;
  navigate: ReturnType<typeof useNavigate>;
  archiveTask: ReturnType<typeof useMutation<typeof api.tasks.archive>>;
}

function TaskItem({ task, navigate, archiveTask }: TaskItemProps) {
  // Query for task runs to find VSCode instances
  const taskRunsQuery = useConvexQuery(api.taskRuns.getByTask, {
    taskId: task._id,
  });

  // Mutation for toggling keep-alive status
  const toggleKeepAlive = useMutation(api.taskRuns.toggleKeepAlive);

  // Find the latest task run with a VSCode instance
  const getLatestVSCodeInstance = () => {
    if (!taskRunsQuery || taskRunsQuery.length === 0) return null;

    // Define task run type with nested structure
    interface TaskRunWithChildren extends Doc<"taskRuns"> {
      children?: TaskRunWithChildren[];
    }

    // Flatten all task runs (including children)
    const allRuns: TaskRunWithChildren[] = [];
    const flattenRuns = (runs: TaskRunWithChildren[]) => {
      runs.forEach((run) => {
        allRuns.push(run);
        if (run.children) {
          flattenRuns(run.children);
        }
      });
    };
    flattenRuns(taskRunsQuery);

    // Find the most recent run with VSCode instance that's running or starting
    const runWithVSCode = allRuns
      .filter(
        (run) =>
          run.vscode &&
          (run.vscode.status === "running" || run.vscode.status === "starting")
      )
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

    return runWithVSCode;
  };

  const runWithVSCode = getLatestVSCodeInstance();
  const hasActiveVSCode = runWithVSCode?.vscode?.status === "running";

  // Generate the VSCode URL if available
  const vscodeUrl =
    hasActiveVSCode &&
    runWithVSCode?.vscode?.containerName &&
    runWithVSCode?.vscode?.ports?.vscode
      ? `http://${runWithVSCode._id.substring(0, 12)}.39378.localhost:9776/`
      : null;

  const clipboard = useClipboard({ timeout: 2000 });

  return (
    <div
      className={clsx(
        "relative group flex items-center gap-2.5 px-3 py-2 border rounded-lg transition-all cursor-default select-none",
        // Check if this is an optimistic update (temporary ID)
        task._id.includes("-") && task._id.length === 36
          ? "bg-white/50 dark:bg-neutral-700/30 border-neutral-200 dark:border-neutral-500/15 animate-pulse"
          : "bg-white dark:bg-neutral-700/50 border-neutral-200 dark:border-neutral-500/15 hover:border-neutral-300 dark:hover:border-neutral-500/30"
      )}
      onClick={() =>
        navigate({
          to: "/task/$taskId",
          params: { taskId: task._id },
        })
      }
    >
      <div
        className={clsx(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          task.isCompleted
            ? "bg-green-500"
            : task._id.includes("-") && task._id.length === 36
              ? "bg-yellow-500"
              : "bg-blue-500 animate-pulse"
        )}
      />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className={clsx(
            "text-[14px] truncate"
            // task.isCompleted
            //   ? "text-neutral-500 dark:text-neutral-400 line-through"
            //   : "text-neutral-900 dark:text-neutral-100"
          )}
        >
          {task.text}
        </span>
        {(task.projectFullName || (task.branch && task.branch !== "main")) && (
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 flex-shrink-0 ml-auto mr-0">
            {task.projectFullName && (
              <span>{task.projectFullName.split("/")[1]}</span>
            )}
            {task.projectFullName &&
              task.branch &&
              task.branch !== "main" &&
              "/"}
            {task.branch && task.branch !== "main" && (
              <span>{task.branch}</span>
            )}
          </span>
        )}
      </div>
      {task.updatedAt && (
        <span className="text-[11px] text-neutral-400 dark:text-neutral-500 flex-shrink-0 ml-auto mr-0">
          {new Date(task.updatedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}

      <div className="right-2 absolute flex gap-1 group-hover:opacity-100 opacity-0">
        {/* Copy button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clipboard.copy(task.text);
                }}
                className={clsx(
                  "p-1 rounded",
                  "bg-neutral-100 dark:bg-neutral-700",
                  "text-neutral-600 dark:text-neutral-400",
                  "hover:bg-neutral-200 dark:hover:bg-neutral-600"
                )}
                title="Copy task description"
              >
                {clipboard.copied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {clipboard.copied ? "Copied!" : "Copy description"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* VSCode button - appears on hover */}
        {vscodeUrl && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={vscodeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={clsx(
                    "p-1 rounded cursor-default",
                    "bg-neutral-100 dark:bg-neutral-700",
                    "text-neutral-600 dark:text-neutral-400",
                    "hover:bg-neutral-200 dark:hover:bg-neutral-600"
                  )}
                >
                  <Code2 className="w-3.5 h-3.5" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="top">Open in VSCode</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Keep-alive button */}
        {runWithVSCode && hasActiveVSCode && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await toggleKeepAlive({
                      id: runWithVSCode._id,
                      keepAlive: !runWithVSCode.vscode?.keepAlive,
                    });
                  }}
                  className={clsx(
                    "p-1 rounded",
                    "bg-neutral-100 dark:bg-neutral-700",
                    runWithVSCode.vscode?.keepAlive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-neutral-600 dark:text-neutral-400",
                    "hover:bg-neutral-200 dark:hover:bg-neutral-600"
                  )}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {runWithVSCode.vscode?.keepAlive
                  ? "Container will stay running"
                  : "Keep container running"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Archive button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            archiveTask({ id: task._id });
          }}
          className={clsx(
            "p-1 rounded",
            "bg-neutral-100 dark:bg-neutral-700",
            "text-neutral-600 dark:text-neutral-400",
            "hover:bg-neutral-200 dark:hover:bg-neutral-600"
          )}
          title="Archive task"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
