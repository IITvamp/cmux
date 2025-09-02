import { FloatingPane } from "@/components/floating-pane";
import { TitleBar } from "@/components/TitleBar";
import { api } from "@cmux/convex/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";

export const Route = createFileRoute("/_layout/$teamSlugOrId/environments")({
  component: EnvironmentsListPage,
});

function EnvironmentsListPage() {
  const { teamSlugOrId } = Route.useParams();
  const envs = useQuery(api.environments.list, { teamSlugOrId }) ?? [];

  return (
    <FloatingPane header={<TitleBar title="Environments" />}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Team-scoped environments with secure variables.
          </p>
          <Link
            to="/$teamSlugOrId/environments/new"
            params={{ teamSlugOrId }}
            search={{
              step: undefined,
              selectedRepos: undefined,
              connectionLogin: undefined,
              repoSearch: undefined,
              sessionId: undefined,
            }}
            className="inline-flex items-center rounded-md bg-neutral-900 text-white px-3 py-2 text-sm hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            New environment
          </Link>
        </div>

        <div className="rounded-md border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          {envs.length === 0 ? (
            <div className="p-6 text-sm text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-950">
              No environments yet. Create one to get started.
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-900">
              {envs.map((e) => (
                <div
                  key={e._id}
                  className="flex items-center justify-between px-4 h-12 bg-white dark:bg-neutral-950"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {e.name}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-500 truncate">
                      Snapshot: {e.morphSnapshotId}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </FloatingPane>
  );
}

