import { CmuxComments } from "@/components/cmux-comments";
import { CommandBar } from "@/components/CommandBar";
import { PersistentWebView } from "@/components/persistent-webview";
import { ResizableRows } from "@/components/ResizableRows";
import { Sidebar } from "@/components/Sidebar";
import { SIDEBAR_PRS_DEFAULT_LIMIT } from "@/components/sidebar/const";
import { convexQueryClient } from "@/contexts/convex/convex-query-client";
import { ExpandTasksProvider } from "@/contexts/expand-tasks/ExpandTasksProvider";
import { useSocket } from "@/contexts/socket/use-socket";
import { cachedGetUser } from "@/lib/cachedGetUser";
import { setLastTeamSlugOrId } from "@/lib/lastTeam";
import { stackClientApp } from "@/lib/stack";
import { api } from "@cmux/convex/api";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import clsx from "clsx";
import { useQuery } from "convex/react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/_layout/$teamSlugOrId")({
  component: LayoutComponentWrapper,
  beforeLoad: async ({ params, location }) => {
    const user = await cachedGetUser(stackClientApp);
    if (!user) {
      throw redirect({
        to: "/sign-in",
        search: {
          after_auth_return_to: location.pathname,
        },
      });
    }
    const { teamSlugOrId } = params;
    const teamMemberships = await convexQueryClient.convexClient.query(
      api.teams.listTeamMemberships,
    );
    const teamMembership = teamMemberships.find((membership) => {
      const team = membership.team;
      const membershipTeamId = team?.teamId ?? membership.teamId;
      const membershipSlug = team?.slug;
      return (
        membershipSlug === teamSlugOrId || membershipTeamId === teamSlugOrId
      );
    });
    if (!teamMembership) {
      throw redirect({ to: "/team-picker" });
    }
  },
  loader: async ({ params }) => {
    void convexQueryClient.queryClient.ensureQueryData(
      convexQuery(api.tasks.get, { teamSlugOrId: params.teamSlugOrId }),
    );
    void convexQueryClient.queryClient.ensureQueryData(
      convexQuery(api.github_prs.listPullRequests, {
        teamSlugOrId: params.teamSlugOrId,
        state: "open",
        limit: SIDEBAR_PRS_DEFAULT_LIMIT,
      }),
    );
  },
});

function LayoutComponent() {
  const { teamSlugOrId } = Route.useParams();
  const tasks = useQuery(api.tasks.get, { teamSlugOrId });
  const { socket } = useSocket();

  const recentTasks = useMemo(() => {
    return (
      tasks
        ?.filter((task) => task.createdAt)
        ?.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) || []
    );
  }, [tasks]);

  const displayTasks = tasks === undefined ? undefined : recentTasks;

  const [showVscode, setShowVscode] = useState(false);
  const [vscodeUrl, setVscodeUrl] = useState<string | null>(null);
  const [vscodeLoaded, setVscodeLoaded] = useState(false);
  const [vscodeError, setVscodeError] = useState<string | null>(null);
  const [isSpawning, setIsSpawning] = useState(false);

  useEffect(() => {
    localStorage.removeItem("main-vscode-chat-split");
  }, []);

  const onVscodeLoad = useCallback(() => {
    console.log("VSCode loaded");
    setVscodeLoaded(true);
    setVscodeError(null);
    setIsSpawning(false);
  }, []);

  const onVscodeError = useCallback((error: Error) => {
    console.error("Failed to load VSCode:", error);
    setVscodeError(error.message);
    setVscodeLoaded(false);
    setIsSpawning(false);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleVscodeSpawned = (data: {
      instanceId: string;
      url: string;
      workspaceUrl: string;
      provider: string;
    }) => {
      console.log("Standalone VSCode spawned:", data);
      setVscodeUrl(data.workspaceUrl);
      setIsSpawning(false);
    };

    socket.on("vscode-spawned", handleVscodeSpawned);

    return () => {
      socket.off("vscode-spawned", handleVscodeSpawned);
    };
  }, [socket]);

  const handleToggleVscode = useCallback(() => {
    if (showVscode) {
      setShowVscode(false);
      return;
    }

    setShowVscode(true);
    if (!vscodeUrl && socket) {
      setIsSpawning(true);
      socket.emit("spawn-standalone-vscode", {});
    }
  }, [showVscode, vscodeUrl, socket]);

  return (
    <>
      <CommandBar teamSlugOrId={teamSlugOrId} />

      <ExpandTasksProvider>
        <div className="flex flex-row grow min-h-0 bg-white dark:bg-black">
          <Sidebar tasks={displayTasks} teamSlugOrId={teamSlugOrId} />

          {showVscode ? (
            <ResizableRows
              storageKey="main-vscode-chat-split"
              defaultTopHeight={80}
              minTop={50}
              maxTop={95}
              separatorHeight={12}
              className="flex-1 min-h-0"
              top={
                <div className="relative h-full flex bg-neutral-50 dark:bg-black">
                  {vscodeUrl ? (
                    <PersistentWebView
                      persistKey="main-vscode"
                      src={vscodeUrl}
                      className="grow flex"
                      iframeClassName="select-none"
                      sandbox="allow-downloads allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation allow-top-navigation-by-user-activation"
                      allow="accelerometer; camera; encrypted-media; fullscreen; geolocation; gyroscope; magnetometer; microphone; midi; payment; usb; xr-spatial-tracking"
                      retainOnUnmount
                      onLoad={onVscodeLoad}
                      onError={onVscodeError}
                    />
                  ) : (
                    <div className="grow" />
                  )}
                  <div
                    className={clsx(
                      "absolute inset-0 flex items-center justify-center transition pointer-events-none bg-neutral-50 dark:bg-black",
                      {
                        "opacity-100": !vscodeLoaded || isSpawning,
                        "opacity-0": vscodeLoaded && !isSpawning,
                      }
                    )}
                  >
                    <div className="flex flex-col items-center gap-3">
                      {vscodeError ? (
                        <>
                          <span className="text-sm text-red-500 dark:text-red-400">
                            Failed to load VSCode
                          </span>
                          <span className="text-xs text-neutral-500">
                            {vscodeError}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="flex gap-1">
                            <div
                              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            />
                            <div
                              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            />
                            <div
                              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                          <span className="text-sm text-neutral-500">
                            {isSpawning
                              ? "Spawning VSCode container..."
                              : "Loading VSCode..."}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 z-10 flex gap-2">
                    <button
                      onClick={() => {
                        localStorage.setItem("main-vscode-chat-split", "80");
                        window.location.reload();
                      }}
                      className="px-3 py-1 bg-neutral-600 dark:bg-neutral-600 text-white text-xs rounded hover:bg-neutral-500 dark:hover:bg-neutral-500"
                      title="Reset split to 80/20"
                    >
                      Reset Split
                    </button>
                    <button
                      onClick={handleToggleVscode}
                      className="px-3 py-1 bg-neutral-800 dark:bg-neutral-700 text-white text-xs rounded hover:bg-neutral-700 dark:hover:bg-neutral-600"
                    >
                      Hide VSCode
                    </button>
                  </div>
                </div>
              }
              bottom={
                <div className="h-full flex flex-col overflow-hidden">
                  <Suspense fallback={<div>Loading...</div>}>
                    <Outlet />
                  </Suspense>
                </div>
              }
            />
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-2 border-b border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={handleToggleVscode}
                  className="px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white text-xs rounded hover:bg-blue-700 dark:hover:bg-blue-600"
                >
                  Show VSCode
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <Suspense fallback={<div>Loading...</div>}>
                  <Outlet />
                </Suspense>
              </div>
            </div>
          )}
        </div>
      </ExpandTasksProvider>

      <button
        onClick={() => {
          const msg = window.prompt("Enter debug note");
          if (msg) {
            console.log(`[USER NOTE] ${msg}`);
          }
        }}
        className="hidden"
        style={{
          position: "fixed",
          bottom: "16px",
          right: "16px",
          zIndex: "var(--z-overlay)",
          background: "#ffbf00",
          color: "#000",
          border: "none",
          borderRadius: "4px",
          padding: "8px 12px",
          cursor: "default",
          fontSize: "12px",
          fontWeight: 600,
          boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
        }}
      >
        Add Debug Note
      </button>
    </>
  );
}

// ConvexClientProvider is already applied in the top-level `/_layout` route.
// Avoid nesting providers here to prevent auth/loading thrash.
function LayoutComponentWrapper() {
  const { teamSlugOrId } = Route.useParams();
  useEffect(() => {
    setLastTeamSlugOrId(teamSlugOrId);
  }, [teamSlugOrId]);
  return (
    <>
      <LayoutComponent />
      <CmuxComments teamSlugOrId={teamSlugOrId} />
    </>
  );
}
