import { CmuxComments } from "@/components/cmux-comments";
import { Sidebar } from "@/components/Sidebar";
import { ExpandTasksProvider } from "@/contexts/expand-tasks/ExpandTasksProvider";
import { isFakeConvexId } from "@/lib/fakeConvexId";
import { api } from "@cmux/convex/api";
import { type Doc, type Id } from "@cmux/convex/dataModel";
// import { convexQuery } from "@convex-dev/react-query";
import { useUser } from "@stackframe/react";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useQueries, useQuery } from "convex/react";
import { Suspense, useMemo } from "react";

export const Route = createFileRoute("/_layout/$teamSlugOrId")({
  component: LayoutComponentWrapper,
  // Prefetch omitted to avoid route param coupling in typecheck
});

function LayoutComponent() {
  const user = useUser({ or: "return-null" });
  const teamSlugOrId =
    typeof window !== "undefined"
      ? window.location.pathname.split("/")[1] || "default"
      : "default";
  // Read teams via Stack hook at top-level (not inside effects)
  const teams = user?.useTeams() ?? [];
  // Hooks below must be called unconditionally
  const tasks = useQuery(api.tasks.get, { teamIdOrSlug: teamSlugOrId });

  // Sort tasks by creation date (newest first) and take the latest 5
  const recentTasks = useMemo(() => {
    return (
      tasks
        ?.filter((task) => task.createdAt)
        ?.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) || []
    );
  }, [tasks]);

  // Create queries object for all recent tasks with memoization, filtering out fake IDs
  const taskRunQueries = useMemo(() => {
    return recentTasks
      .filter((task) => !isFakeConvexId(task._id))
      .reduce(
        (acc, task) => ({
          ...acc,
          [task._id]: {
            query: api.taskRuns.getByTask,
            args: { teamIdOrSlug: teamSlugOrId, taskId: task._id },
          },
        }),
        {} as Record<
          Id<"tasks">,
          {
            query: typeof api.taskRuns.getByTask;
            args: ((d: { params: { teamSlugOrId: string } }) => { teamIdOrSlug: string; taskId: Id<"tasks"> }) | { teamIdOrSlug: string; taskId: Id<"tasks"> };
          }
        >
      );
  }, [recentTasks, teamSlugOrId]);

  // Fetch task runs for all recent tasks using useQueries
  const taskRunResults = useQueries(
    taskRunQueries as Parameters<typeof useQueries>[0]
  );

  // Map tasks with their respective runs
  const tasksWithRuns = useMemo(
    () =>
      recentTasks.map((task: Doc<"tasks">) => ({
        ...task,
        runs: taskRunResults[task._id] || [],
      })),
    [recentTasks, taskRunResults]
  );

  // Perform redirects after hooks are called to keep order consistent
  if (user) {
    if (teams.length === 0) {
      return <Navigate to="/team-picker" />;
    }
    if (teams.length === 1 && teamSlugOrId !== teams[0]!.id) {
      const cm = teams[0]!.clientMetadata as unknown;
      const slug =
        cm && typeof cm === "object" && cm !== null && "slug" in (cm as Record<string, unknown>) &&
        typeof (cm as Record<string, unknown>).slug === "string"
          ? ((cm as Record<string, unknown>).slug as string)
          : teams[0]!.id;
      return <Navigate to="/$teamSlugOrId/dashboard" params={{ teamSlugOrId: slug }} />;
    }
    if (
      teams.length > 1 &&
      (teamSlugOrId === "default" || !teams.some((t) => t.id === teamSlugOrId))
    ) {
      return <Navigate to="/team-picker" />;
    }
  }
  return (
    <>
      <ExpandTasksProvider>
        <div className="flex flex-row grow bg-white dark:bg-black">
          <Sidebar tasks={tasks} tasksWithRuns={tasksWithRuns} />

          {/* <div className="flex flex-col grow overflow-hidden bg-white dark:bg-neutral-950"> */}
          <Suspense fallback={<div>Loading...</div>}>
            <Outlet />
          </Suspense>
          {/* </div> */}
        </div>
      </ExpandTasksProvider>

      <button
        onClick={() => {
          const msg = window.prompt("Enter debug note");
          if (msg) {
            // Prefix allows us to easily grep in the console.

            console.log(`[USER NOTE] ${msg}`);
          }
        }}
        className="hidden"
        style={{
          position: "fixed",
          bottom: "16px",
          right: "16px",
          zIndex: 9999,
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
  return (
    <>
      <LayoutComponent />
      <CmuxComments />
    </>
  );
}
