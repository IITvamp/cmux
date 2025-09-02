import { FloatingPane } from "@/components/floating-pane";
import { TitleBar } from "@/components/TitleBar";
// TODO: Replace with actual API query once OpenAPI client is regenerated
// import { getApiEnvironmentsQuery } from "@cmux/www-openapi-client/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Plus, Server, Calendar, Loader2, GitBranch } from "lucide-react";

export const Route = createFileRoute("/_layout/$teamSlugOrId/environments/")({
  component: EnvironmentsListPage,
});

function EnvironmentsListPage() {
  const { teamSlugOrId } = Route.useParams();
  
  // TODO: Replace with actual API query once OpenAPI client is regenerated
  const { data: environments, isLoading } = useQuery({
    queryKey: ["environments", teamSlugOrId],
    queryFn: async () => {
      // Temporary mock data - will be replaced with actual API call
      return [] as Array<{
        id: string;
        name: string;
        morphSnapshotId: string;
        dataVaultKey: string;
        selectedRepos?: string[];
        description?: string;
        createdAt: number;
        updatedAt: number;
      }>;
    },
  });

  return (
    <FloatingPane header={<TitleBar title="Environments" /> }>
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
          </div>
        ) : environments && environments?.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {environments?.map((env) => (
              <div
                key={env.id}
                className="group relative rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                    <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                      {env.name}
                    </h3>
                  </div>
                </div>

                {env.description && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 line-clamp-2">
                    {env.description}
                  </p>
                )}

                {env.selectedRepos && env.selectedRepos.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-500 mb-1">
                      <GitBranch className="w-3 h-3" />
                      Repositories
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {env.selectedRepos.slice(0, 3).map((repo) => (
                        <span
                          key={repo}
                          className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 text-xs text-neutral-700 dark:text-neutral-300"
                        >
                          {repo.split("/")[1] || repo}
                        </span>
                      ))}
                      {env.selectedRepos.length > 3 && (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 text-xs text-neutral-700 dark:text-neutral-300">
                          +{env.selectedRepos.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(env.createdAt), {
                      addSuffix: true,
                    })}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-900">
                  <div className="text-xs text-neutral-500 dark:text-neutral-500">
                    Snapshot ID: {env.morphSnapshotId}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
              <Server className="w-8 h-8 text-neutral-400 dark:text-neutral-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              No environments yet
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">
              Create your first environment to save and reuse development configurations
              across your team.
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
              className="inline-flex items-center gap-2 rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Plus className="w-4 h-4" />
              Create First Environment
            </Link>
          </div>
        )}
      </div>
    </FloatingPane>
  );
}
