import {
  DashboardInput,
  type EditorApi,
} from "@/components/dashboard/DashboardInput";
import { DashboardInputControls } from "@/components/dashboard/DashboardInputControls";
import { DashboardInputFooter } from "@/components/dashboard/DashboardInputFooter";
import { DashboardStartTaskButton } from "@/components/dashboard/DashboardStartTaskButton";
import { TaskList } from "@/components/dashboard/TaskList";
import { FloatingPane } from "@/components/floating-pane";
import { GitHubIcon } from "@/components/icons/github";
import { useTheme } from "@/components/theme/use-theme";
import { TitleBar } from "@/components/TitleBar";
import type { SelectOption } from "@/components/ui/searchable-select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useExpandTasks } from "@/contexts/expand-tasks/ExpandTasksContext";
import { useSocket } from "@/contexts/socket/use-socket";
import { createFakeConvexId } from "@/lib/fakeConvexId";
import { branchesQueryOptions } from "@/queries/branches";
import { api } from "@cmux/convex/api";
import type { Doc, Id } from "@cmux/convex/dataModel";
import type { ProviderStatusResponse } from "@cmux/shared";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Server as ServerIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface PreSpawnedSandbox {
  instanceId: string;
  vscodeUrl: string;
  workerUrl: string;
  provider: "morph";
  createdAt: number;
  teamId: string;
  environmentId?: string;
  snapshotId?: string;
}

export const Route = createFileRoute("/_layout/$teamSlugOrId/dashboard")({
  component: DashboardComponent,
});

// Default agents (not persisted to localStorage)
const DEFAULT_AGENTS = [
  "claude/sonnet-4.5",
  "claude/opus-4.1",
  "codex/gpt-5-codex-high",
];

function DashboardComponent() {
  const { teamSlugOrId } = Route.useParams();
  const searchParams = Route.useSearch() as { environmentId?: string };
  const { socket } = useSocket();
  const { theme } = useTheme();
  const { addTaskToExpand } = useExpandTasks();

  const [selectedProject, setSelectedProject] = useState<string[]>(() => {
    const stored = localStorage.getItem("selectedProject");
    return stored ? JSON.parse(stored) : [];
  });
  const [selectedBranch, setSelectedBranch] = useState<string[]>([]);

  const [selectedAgents, setSelectedAgents] = useState<string[]>(() => {
    const stored = localStorage.getItem("selectedAgents");
    // Only use stored value if it exists and has selections, otherwise use defaults
    return stored && JSON.parse(stored).length > 0
      ? JSON.parse(stored)
      : DEFAULT_AGENTS;
  });
  const [taskDescription, setTaskDescription] = useState<string>("");
  const [isCloudMode, setIsCloudMode] = useState<boolean>(() => {
    const stored = localStorage.getItem("isCloudMode");
    return stored ? JSON.parse(stored) : false;
  });
  const [preSpawnedSandboxes, setPreSpawnedSandboxes] = useState<
    PreSpawnedSandbox[]
  >(() => {
    const stored = sessionStorage.getItem("preSpawnedSandboxes");
    return stored ? JSON.parse(stored) : [];
  });

  const [, setDockerReady] = useState<boolean | null>(null);
  const [providerStatus, setProviderStatus] =
    useState<ProviderStatusResponse | null>(null);

  // Ref to access editor API
  const editorApiRef = useRef<EditorApi | null>(null);

  // Preselect environment if provided in URL search params
  useEffect(() => {
    if (searchParams?.environmentId) {
      const val = `env:${searchParams.environmentId}`;
      setSelectedProject([val]);
      localStorage.setItem("selectedProject", JSON.stringify([val]));
      setIsCloudMode(true);
      localStorage.setItem("isCloudMode", JSON.stringify(true));
    }
  }, [searchParams?.environmentId]);

  // Callback for task description changes
  const handleTaskDescriptionChange = useCallback(
    (value: string) => {
      setTaskDescription(value);

      // Pre-spawn sandboxes when user starts typing and we have selected agents
      if (
        value.trim().length > 0 &&
        selectedAgents.length > 0 &&
        preSpawnedSandboxes.length === 0
      ) {
        preSpawnSandboxes();
      }
    },
    [selectedAgents.length, preSpawnedSandboxes.length],
  );

  // Function to pre-spawn sandboxes
  const preSpawnSandboxes = useCallback(async () => {
    if (!selectedProject[0] || selectedAgents.length === 0) return;

    try {
      const response = await fetch("/api/sandboxes/pre-spawn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamSlugOrId,
          count: Math.min(selectedAgents.length, 3), // Pre-spawn up to 3 sandboxes
          environmentId: selectedProject[0]?.startsWith("env:")
            ? selectedProject[0].replace("env:", "")
            : undefined,
          snapshotId: undefined, // Could be enhanced to use a specific snapshot
          ttlSeconds: 20 * 60,
          metadata: {
            preSpawned: "true",
            dashboard: "true",
          },
        }),
      });

      if (!response.ok) {
        console.warn("Failed to pre-spawn sandboxes:", response.statusText);
        return;
      }

      const data = await response.json();
      setPreSpawnedSandboxes(data.sandboxes);
      sessionStorage.setItem(
        "preSpawnedSandboxes",
        JSON.stringify(data.sandboxes),
      );
      console.log(`Pre-spawned ${data.sandboxes.length} sandboxes`);
    } catch (error) {
      console.warn("Error pre-spawning sandboxes:", error);
    }
  }, [selectedProject, selectedAgents.length, teamSlugOrId]);

  // Function to clean up old pre-spawned sandboxes
  const cleanupOldSandboxes = useCallback(async () => {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    const validSandboxes = preSpawnedSandboxes.filter((sandbox) => {
      const age = now - sandbox.createdAt;
      return age < maxAge;
    });

    // Stop old sandboxes
    const oldSandboxes = preSpawnedSandboxes.filter((sandbox) => {
      const age = now - sandbox.createdAt;
      return age >= maxAge;
    });

    for (const sandbox of oldSandboxes) {
      try {
        await fetch(`/api/sandboxes/${sandbox.instanceId}/stop`, {
          method: "POST",
        });
        console.log(`Cleaned up old sandbox: ${sandbox.instanceId}`);
      } catch (error) {
        console.warn(
          `Failed to stop old sandbox ${sandbox.instanceId}:`,
          error,
        );
      }
    }

    if (validSandboxes.length !== preSpawnedSandboxes.length) {
      setPreSpawnedSandboxes(validSandboxes);
      sessionStorage.setItem(
        "preSpawnedSandboxes",
        JSON.stringify(validSandboxes),
      );
    }
  }, [preSpawnedSandboxes]);

  // Fetch branches for selected repo from Convex
  const isEnvSelected = useMemo(
    () => (selectedProject[0] || "").startsWith("env:"),
    [selectedProject],
  );

  const branchesQuery = useQuery({
    ...branchesQueryOptions({
      teamSlugOrId,
      repoFullName: selectedProject[0] || "",
    }),
    enabled: !!selectedProject[0] && !isEnvSelected,
  });
  const branches = useMemo(
    () => branchesQuery.data || [],
    [branchesQuery.data],
  );
  // Callback for project selection changes
  const handleProjectChange = useCallback(
    (newProjects: string[]) => {
      setSelectedProject(newProjects);
      localStorage.setItem("selectedProject", JSON.stringify(newProjects));
      if (newProjects[0] !== selectedProject[0]) {
        setSelectedBranch([]);
      }
      // If selecting an environment, enforce cloud mode
      if ((newProjects[0] || "").startsWith("env:")) {
        setIsCloudMode(true);
        localStorage.setItem("isCloudMode", JSON.stringify(true));
      }
    },
    [selectedProject],
  );

  // Callback for branch selection changes
  const handleBranchChange = useCallback((newBranches: string[]) => {
    setSelectedBranch(newBranches);
  }, []);

  // Callback for agent selection changes
  const handleAgentChange = useCallback((newAgents: string[]) => {
    setSelectedAgents(newAgents);
    // Only persist to localStorage if the user made a selection (not using defaults)
    // If newAgents is empty or equals defaults, remove from localStorage
    const isDefault =
      newAgents.length === DEFAULT_AGENTS.length &&
      newAgents.every((agent, index) => agent === DEFAULT_AGENTS[index]);

    if (isDefault || newAgents.length === 0) {
      localStorage.removeItem("selectedAgents");
    } else {
      localStorage.setItem("selectedAgents", JSON.stringify(newAgents));
    }
  }, []);

  // Fetch repos from Convex
  const reposByOrgQuery = useQuery({
    ...convexQuery(api.github.getReposByOrg, { teamSlugOrId }),
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
  const reposByOrg = useMemo(
    () => reposByOrgQuery.data || {},
    [reposByOrgQuery.data],
  );

  // Socket-based functions to fetch data from GitHub
  // Removed unused fetchRepos function - functionality is handled by Convex queries

  const checkProviderStatus = useCallback(() => {
    if (!socket) return;

    socket.emit("check-provider-status", (response) => {
      if (!response) return;
      setProviderStatus(response);
      if (response.success) {
        const isRunning = response.dockerStatus?.isRunning;
        if (typeof isRunning === "boolean") {
          setDockerReady(isRunning);
        }
      }
    });
  }, [socket]);

  // Mutation to create tasks with optimistic update
  const createTask = useMutation(api.tasks.create).withOptimisticUpdate(
    (localStore, args) => {
      const currentTasks = localStore.getQuery(api.tasks.get, {
        teamSlugOrId,
      });

      if (currentTasks !== undefined) {
        const now = Date.now();
        const optimisticTask = {
          _id: createFakeConvexId() as Doc<"tasks">["_id"],
          _creationTime: now,
          text: args.text,
          description: args.description,
          projectFullName: args.projectFullName,
          baseBranch: args.baseBranch,
          worktreePath: args.worktreePath,
          isCompleted: false,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
          images: args.images,
          userId: "optimistic",
          teamId: teamSlugOrId,
          environmentId: args.environmentId,
        };

        // Add the new task at the beginning (since we order by desc)
        const listArgs: {
          teamSlugOrId: string;
          projectFullName?: string;
          archived?: boolean;
        } = {
          teamSlugOrId,
        };
        localStore.setQuery(api.tasks.get, listArgs, [
          optimisticTask,
          ...currentTasks,
        ]);
      }
    },
  );
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  const effectiveSelectedBranch = useMemo(
    () =>
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
          : [],
    [selectedBranch, branches],
  );

  const handleStartTask = useCallback(async () => {
    // For local mode, perform a fresh docker check right before starting
    if (!isEnvSelected && !isCloudMode) {
      // Always check Docker status when in local mode, regardless of current state
      if (socket) {
        const ready = await new Promise<boolean>((resolve) => {
          socket.emit("check-provider-status", (response) => {
            const isRunning = !!response?.dockerStatus?.isRunning;
            if (typeof isRunning === "boolean") {
              setDockerReady(isRunning);
            }
            resolve(isRunning);
          });
        });

        // Only show the alert if Docker is actually not running after checking
        if (!ready) {
          toast.error("Docker is not running. Start Docker Desktop.");
          return;
        }
      } else {
        // If socket is not connected, we can't verify Docker status
        console.error("Cannot verify Docker status: socket not connected");
        toast.error(
          "Cannot verify Docker status. Please ensure the server is running.",
        );
        return;
      }
    }

    if (!selectedProject[0] || !taskDescription.trim()) {
      console.error("Please select a project and enter a task description");
      return;
    }
    if (!socket) {
      console.error("Socket not connected");
      return;
    }

    // Use the effective selected branch (respects available branches and sensible defaults)
    const branch = effectiveSelectedBranch[0];
    const projectFullName = selectedProject[0];
    const envSelected = projectFullName.startsWith("env:");
    const environmentId = envSelected
      ? (projectFullName.replace(/^env:/, "") as Id<"environments">)
      : undefined;

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
            const uploadUrl = await generateUploadUrl({
              teamSlugOrId,
            });
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
          },
        ),
      );

      // Clear input after successful task creation
      setTaskDescription("");
      // Force editor to clear
      handleTaskDescriptionChange("");
      if (editorApiRef.current?.clear) {
        editorApiRef.current.clear();
      }

      // Create task in Convex with storage IDs
      const taskId = await createTask({
        teamSlugOrId,
        text: content?.text || taskDescription, // Use content.text which includes image references
        projectFullName: envSelected ? undefined : projectFullName,
        baseBranch: envSelected ? undefined : branch,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
        environmentId,
      });

      // Hint the sidebar to auto-expand this task once it appears
      addTaskToExpand(taskId);

      const repoUrl = envSelected
        ? undefined
        : `https://github.com/${projectFullName}.git`;

      // For socket.io, we need to send the content text (which includes image references) and the images
      socket.emit(
        "start-task",
        {
          ...(repoUrl ? { repoUrl } : {}),
          ...(envSelected ? {} : { branch }),
          taskDescription: content?.text || taskDescription, // Use content.text which includes image references
          projectFullName,
          taskId,
          selectedAgents:
            selectedAgents.length > 0 ? selectedAgents : undefined,
          isCloudMode: envSelected ? true : isCloudMode,
          ...(environmentId ? { environmentId } : {}),
          images: images.length > 0 ? images : undefined,
          theme,
          preSpawnedSandboxes:
            preSpawnedSandboxes.length > 0 ? preSpawnedSandboxes : undefined,
        },
        (response) => {
          if ("error" in response) {
            console.error("Task start error:", response.error);
            toast.error(`Task start error: ${JSON.stringify(response.error)}`);
          } else {
            console.log("Task started:", response);
            // Clear pre-spawned sandboxes after successful task start
            setPreSpawnedSandboxes([]);
            sessionStorage.removeItem("preSpawnedSandboxes");
          }
        },
      );
      console.log("Task created:", taskId);
    } catch (error) {
      console.error("Error starting task:", error);
    }
  }, [
    selectedProject,
    taskDescription,
    socket,
    effectiveSelectedBranch,
    handleTaskDescriptionChange,
    createTask,
    teamSlugOrId,
    addTaskToExpand,
    selectedAgents,
    isCloudMode,
    isEnvSelected,
    theme,
    generateUploadUrl,
  ]);

  // Fetch repos on mount if none exist
  // useEffect(() => {
  //   if (Object.keys(reposByOrg).length === 0) {
  //     fetchRepos();
  //   }
  // }, [reposByOrg, fetchRepos]);

  // Check provider status on mount and keep it fresh without page refresh
  useEffect(() => {
    // Initial check
    checkProviderStatus();

    // Poll while the dashboard is open so Docker state updates live
    const interval = setInterval(() => {
      checkProviderStatus();
    }, 5000);

    // Also refresh on window focus to catch recent changes quickly
    const handleFocus = () => checkProviderStatus();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkProviderStatus]);

  // Clean up old pre-spawned sandboxes periodically
  useEffect(() => {
    const cleanupInterval = setInterval(
      () => {
        cleanupOldSandboxes();
      },
      5 * 60 * 1000,
    ); // Clean up every 5 minutes

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [cleanupOldSandboxes]);

  // Format repos for multiselect
  // Fetch environments
  const environmentsQuery = useQuery(
    convexQuery(api.environments.list, { teamSlugOrId }),
  );

  const projectOptions = useMemo(() => {
    // Repo options as objects with GitHub icon
    const repoDocs = Object.values(reposByOrg || {}).flatMap((repos) => repos);
    const uniqueRepos = repoDocs.reduce((acc, repo) => {
      const existing = acc.get(repo.fullName);
      if (!existing) {
        acc.set(repo.fullName, repo);
        return acc;
      }
      const existingActivity =
        existing.lastPushedAt ?? Number.NEGATIVE_INFINITY;
      const candidateActivity = repo.lastPushedAt ?? Number.NEGATIVE_INFINITY;
      if (candidateActivity > existingActivity) {
        acc.set(repo.fullName, repo);
      }
      return acc;
    }, new Map<string, Doc<"repos">>());
    const sortedRepos = Array.from(uniqueRepos.values()).sort((a, b) => {
      const aPushedAt = a.lastPushedAt ?? Number.NEGATIVE_INFINITY;
      const bPushedAt = b.lastPushedAt ?? Number.NEGATIVE_INFINITY;
      if (aPushedAt !== bPushedAt) {
        return bPushedAt - aPushedAt;
      }
      return a.fullName.localeCompare(b.fullName);
    });
    const repoOptions = sortedRepos.map((repo) => ({
      label: repo.fullName,
      value: repo.fullName,
      icon: (
        <GitHubIcon className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
      ),
      iconKey: "github",
    }));

    // Environment options as objects with an icon and stable key
    const envOptions = (environmentsQuery.data || []).map((env) => ({
      label: `${env.name}`,
      value: `env:${env._id}`,
      icon: (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <ServerIcon className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Environment: {env.name}</TooltipContent>
        </Tooltip>
      ),
      iconKey: "environment",
    }));

    const options: SelectOption[] = [];
    if (envOptions.length > 0) {
      options.push({
        label: "Environments",
        value: "__heading-env",
        heading: true,
      });
      options.push(...envOptions);
    }
    if (repoOptions.length > 0) {
      options.push({
        label: "Repositories",
        value: "__heading-repo",
        heading: true,
      });
      options.push(...repoOptions);
    }

    return options;
  }, [reposByOrg, environmentsQuery.data]);

  const branchOptions = branches || [];

  // Cloud mode toggle handler
  const handleCloudModeToggle = useCallback(() => {
    if (isEnvSelected) return; // environment forces cloud mode
    const newMode = !isCloudMode;
    setIsCloudMode(newMode);
    localStorage.setItem("isCloudMode", JSON.stringify(newMode));
  }, [isCloudMode, isEnvSelected]);

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

  // Listen for default repo from CLI
  useEffect(() => {
    if (!socket) return;

    const handleDefaultRepo = (data: {
      repoFullName: string;
      branch?: string;
      localPath: string;
    }) => {
      // Always set the selected project when a default repo is provided
      // This ensures CLI-provided repos take precedence
      setSelectedProject([data.repoFullName]);
      localStorage.setItem(
        "selectedProject",
        JSON.stringify([data.repoFullName]),
      );

      // Set the selected branch
      if (data.branch) {
        setSelectedBranch([data.branch]);
      }
    };

    socket.on("default-repo", handleDefaultRepo);

    return () => {
      socket.off("default-repo", handleDefaultRepo);
    };
  }, [socket]);

  // Global keydown handler for autofocus
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Skip if already focused on an input, textarea, or contenteditable that's NOT the editor
      const activeElement = document.activeElement;
      const isEditor =
        activeElement?.getAttribute("data-cmux-input") === "true";
      const isCommentInput = activeElement?.id === "cmux-comments-root";
      if (
        !isEditor &&
        (activeElement?.tagName === "INPUT" ||
          activeElement?.tagName === "TEXTAREA" ||
          activeElement?.getAttribute("contenteditable") === "true" ||
          activeElement?.closest('[contenteditable="true"]') ||
          isCommentInput)
      ) {
        return;
      }

      // Skip for modifier keys and special keys
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.key === "Tab" ||
        e.key === "Escape" ||
        e.key === "Enter" ||
        e.key.startsWith("F") || // Function keys
        e.key.startsWith("Arrow") ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "PageUp" ||
        e.key === "PageDown" ||
        e.key === "Delete" ||
        e.key === "Backspace" ||
        e.key === "CapsLock" ||
        e.key === "Control" ||
        e.key === "Shift" ||
        e.key === "Alt" ||
        e.key === "Meta" ||
        e.key === "ContextMenu"
      ) {
        return;
      }

      // Check if it's a printable character (including shift for uppercase)
      if (e.key.length === 1) {
        // Prevent default to avoid duplicate input
        e.preventDefault();

        // Focus the editor and insert the character
        if (editorApiRef.current?.focus) {
          editorApiRef.current.focus();

          // Insert the typed character
          if (editorApiRef.current.insertText) {
            editorApiRef.current.insertText(e.key);
          }
        }
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  // Do not pre-disable UI on Docker status; handle fresh check on submit

  // Handle Command+Enter keyboard shortcut
  const handleSubmit = useCallback(() => {
    if (selectedProject[0] && taskDescription.trim()) {
      void handleStartTask();
    }
  }, [selectedProject, taskDescription, handleStartTask]);

  // Memoized computed values for editor props
  const lexicalRepoUrl = useMemo(() => {
    if (!selectedProject[0]) return undefined;
    if (isEnvSelected) return undefined;
    return `https://github.com/${selectedProject[0]}.git`;
  }, [selectedProject, isEnvSelected]);

  const lexicalBranch = useMemo(
    () => effectiveSelectedBranch[0],
    [effectiveSelectedBranch],
  );

  const canSubmit = useMemo(() => {
    if (!selectedProject[0]) return false;
    if (!taskDescription.trim()) return false;
    if (selectedAgents.length === 0) return false;
    if (isEnvSelected) return true; // no branch required when environment selected
    return !!effectiveSelectedBranch[0];
  }, [
    selectedProject,
    taskDescription,
    selectedAgents,
    isEnvSelected,
    effectiveSelectedBranch,
  ]);

  return (
    <FloatingPane header={<TitleBar title="cmux" />}>
      <div className="flex flex-col grow overflow-y-auto">
        {/* Main content area */}
        <div className="flex-1 flex justify-center px-4 pt-60 pb-4">
          <div className="w-full max-w-4xl min-w-0">
            <DashboardMainCard
              editorApiRef={editorApiRef}
              onTaskDescriptionChange={handleTaskDescriptionChange}
              onSubmit={handleSubmit}
              lexicalRepoUrl={lexicalRepoUrl}
              lexicalBranch={lexicalBranch}
              projectOptions={projectOptions}
              selectedProject={selectedProject}
              onProjectChange={handleProjectChange}
              branchOptions={branchOptions}
              selectedBranch={effectiveSelectedBranch}
              onBranchChange={handleBranchChange}
              selectedAgents={selectedAgents}
              onAgentChange={handleAgentChange}
              isCloudMode={isCloudMode}
              onCloudModeToggle={handleCloudModeToggle}
              isLoadingProjects={reposByOrgQuery.isLoading}
              isLoadingBranches={branchesQuery.isPending}
              teamSlugOrId={teamSlugOrId}
              cloudToggleDisabled={isEnvSelected}
              branchDisabled={isEnvSelected || !selectedProject[0]}
              providerStatus={providerStatus}
              canSubmit={canSubmit}
              onStartTask={handleStartTask}
            />

            {/* Task List */}
            <TaskList teamSlugOrId={teamSlugOrId} />
          </div>
        </div>
      </div>
    </FloatingPane>
  );
}

type DashboardMainCardProps = {
  editorApiRef: React.MutableRefObject<EditorApi | null>;
  onTaskDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  lexicalRepoUrl?: string;
  lexicalBranch?: string;
  projectOptions: SelectOption[];
  selectedProject: string[];
  onProjectChange: (newProjects: string[]) => void;
  branchOptions: string[];
  selectedBranch: string[];
  onBranchChange: (newBranches: string[]) => void;
  selectedAgents: string[];
  onAgentChange: (newAgents: string[]) => void;
  isCloudMode: boolean;
  onCloudModeToggle: () => void;
  isLoadingProjects: boolean;
  isLoadingBranches: boolean;
  teamSlugOrId: string;
  cloudToggleDisabled: boolean;
  branchDisabled: boolean;
  providerStatus: ProviderStatusResponse | null;
  canSubmit: boolean;
  onStartTask: () => void;
};

function DashboardMainCard({
  editorApiRef,
  onTaskDescriptionChange,
  onSubmit,
  lexicalRepoUrl,
  lexicalBranch,
  projectOptions,
  selectedProject,
  onProjectChange,
  branchOptions,
  selectedBranch,
  onBranchChange,
  selectedAgents,
  onAgentChange,
  isCloudMode,
  onCloudModeToggle,
  isLoadingProjects,
  isLoadingBranches,
  teamSlugOrId,
  cloudToggleDisabled,
  branchDisabled,
  providerStatus,
  canSubmit,
  onStartTask,
}: DashboardMainCardProps) {
  return (
    <div className="relative bg-white dark:bg-neutral-700/50 border border-neutral-500/15 dark:border-neutral-500/15 rounded-2xl transition-all">
      <DashboardInput
        ref={editorApiRef}
        onTaskDescriptionChange={onTaskDescriptionChange}
        onSubmit={onSubmit}
        repoUrl={lexicalRepoUrl}
        branch={lexicalBranch}
        persistenceKey="dashboard-task-description"
        maxHeight="300px"
      />

      <DashboardInputFooter>
        <DashboardInputControls
          projectOptions={projectOptions}
          selectedProject={selectedProject}
          onProjectChange={onProjectChange}
          branchOptions={branchOptions}
          selectedBranch={selectedBranch}
          onBranchChange={onBranchChange}
          selectedAgents={selectedAgents}
          onAgentChange={onAgentChange}
          isCloudMode={isCloudMode}
          onCloudModeToggle={onCloudModeToggle}
          isLoadingProjects={isLoadingProjects}
          isLoadingBranches={isLoadingBranches}
          teamSlugOrId={teamSlugOrId}
          cloudToggleDisabled={cloudToggleDisabled}
          branchDisabled={branchDisabled}
          providerStatus={providerStatus}
        />
        <DashboardStartTaskButton
          canSubmit={canSubmit}
          onStartTask={onStartTask}
        />
      </DashboardInputFooter>
    </div>
  );
}
