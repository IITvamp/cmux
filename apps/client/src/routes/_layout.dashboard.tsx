import { DashboardInputControls } from "@/components/dashboard/DashboardInputControls";
import { DashboardInput, type EditorApi } from "@/components/dashboard/DashboardInput";
import { TaskList } from "@/components/dashboard/TaskList";
import { FloatingPane } from "@/components/floating-pane";
import { ProviderStatusPills } from "@/components/provider-status-pills";
import { useSocket } from "@/contexts/socket/use-socket";
import { createFakeConvexId } from "@/lib/fakeConvexId";
import { useStackAuth } from "@/hooks/useStackAuth";
import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/_layout/dashboard")({
  component: DashboardComponent,
});

function DashboardComponent() {
  const user = useStackAuth();
  const navigate = useNavigate();
  const { socket } = useSocket();

  // Redirect if not authenticated
  useEffect(() => {
    // Skip redirect during initial loading
    if (user === undefined) return;
    
    if (!user) {
      navigate({ to: "/auth/login" });
    }
  }, [user, navigate]);

  const [selectedProject, setSelectedProject] = useState<string[]>(() => {
    const stored = localStorage.getItem("selectedProject");
    return stored ? JSON.parse(stored) : [];
  });
  const [selectedBranch, setSelectedBranch] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>(() => {
    const stored = localStorage.getItem("selectedAgents");
    return stored ? JSON.parse(stored) : ["claude/sonnet-4", "codex/gpt-4.1"];
  });
  const [taskDescription, setTaskDescription] = useState<string>("");
  const [isCloudMode, setIsCloudMode] = useState<boolean>(() => {
    const stored = localStorage.getItem("isCloudMode");
    return stored ? JSON.parse(stored) : false;
  });

  // State for loading states
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

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
  // Removed unused fetchRepos function - functionality is handled by Convex queries

  const checkProviderStatus = useCallback(() => {
    if (!socket) return;

    socket.emit("check-provider-status", (response) => {
      if (response.success) {
        checkProviderStatus();
      }
    });
  }, [socket]);

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

  // Check provider status on mount
  useEffect(() => {
    checkProviderStatus();
  }, [checkProviderStatus]);

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

  // Cloud mode toggle handler
  const handleCloudModeToggle = useCallback(() => {
    const newMode = !isCloudMode;
    setIsCloudMode(newMode);
    localStorage.setItem("isCloudMode", JSON.stringify(newMode));
  }, [isCloudMode]);

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

  // Global keydown handler for autofocus
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Skip if already focused on an input, textarea, or contenteditable
      const activeElement = document.activeElement;
      if (
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.getAttribute("contenteditable") === "true" ||
        activeElement?.closest('[contenteditable="true"]')
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

  // Handle Command+Enter keyboard shortcut
  const handleSubmit = useCallback(() => {
    if (selectedProject[0] && taskDescription.trim()) {
      handleStartTask();
    }
  }, [selectedProject, taskDescription, handleStartTask]);

  // Memoized computed values for editor props
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

  const canSubmit = useMemo(
    () => !!selectedProject[0] && !!taskDescription.trim() && !!effectiveSelectedBranch[0] && selectedAgents.length > 0,
    [selectedProject, taskDescription, effectiveSelectedBranch, selectedAgents]
  );

  return (
    <FloatingPane>
      <div className="flex flex-col grow overflow-y-auto">
        {/* Main content area */}
        <div className="flex-1 flex justify-center px-4 pt-60 pb-4">
          <div className="w-full max-w-4xl">
                      <div
            className={clsx(
              "relative bg-white dark:bg-neutral-700/50 border border-neutral-200 dark:border-neutral-500/15 rounded-2xl transition-all"
            )}
          >
              {/* Provider Status Pills */}
              <ProviderStatusPills />
              
              {/* Editor Input */}
              <DashboardInput
                ref={editorApiRef}
                onTaskDescriptionChange={handleTaskDescriptionChange}
                onSubmit={handleSubmit}
                repoUrl={lexicalRepoUrl}
                branch={lexicalBranch}
                persistenceKey="dashboard-task-description"
                maxHeight="300px"
              />

              {/* Integrated controls */}
              <DashboardInputControls
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
                isLoadingBranches={isLoadingBranches || branchesQuery.isLoading}
                canSubmit={canSubmit}
                onStartTask={handleStartTask}
              />
            </div>

            {/* Task List */}
            {tasksQuery.data && <TaskList tasks={tasksQuery.data} />}
          </div>
        </div>
      </div>
    </FloatingPane>
  );
}

