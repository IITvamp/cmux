import { FloatingPane } from "@/components/floating-pane";
import { TitleBar } from "@/components/TitleBar";
import { convexQueryClient } from "@/contexts/convex/convex-query-client";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Code,
  Edit,
  GitBranch,
  Package,
  Play,
  Save,
  Server,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/environments/$environmentId"
)({
  parseParams: (params) => ({
    ...params,
    environmentId: typedZid("environments").parse(params.environmentId),
  }),
  loader: async ({ params }) => {
    await convexQueryClient.queryClient.ensureQueryData(
      convexQuery(api.environments.get, {
        teamSlugOrId: params.teamSlugOrId,
        id: params.environmentId,
      })
    );
  },
  component: EnvironmentDetailsPage,
  validateSearch: () => ({}),
});

function EnvironmentDetailsPage() {
  const { teamSlugOrId, environmentId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingPorts, setIsEditingPorts] = useState(false);
  const [editingPorts, setEditingPorts] = useState<number[]>([]);
  const [newPort, setNewPort] = useState("");

  const { data: environment } = useSuspenseQuery(
    convexQuery(api.environments.get, {
      teamSlugOrId,
      id: environmentId,
    })
  );
  const deleteEnvironment = useMutation(api.environments.remove);
  const updateEnvironment = useMutation(api.environments.update);

  // Initialize editing ports when environment data is loaded
  useEffect(() => {
    if (environment?.exposedPorts) {
      setEditingPorts(environment.exposedPorts);
    }
  }, [environment?.exposedPorts]);

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this environment? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteEnvironment({
        teamSlugOrId,
        id: environmentId,
      });
      toast.success("Environment deleted successfully");
      navigate({
        to: "/$teamSlugOrId/environments",
        params: { teamSlugOrId },
        search: {
          step: undefined,
          selectedRepos: undefined,
          connectionLogin: undefined,
          repoSearch: undefined,
          instanceId: undefined,
        },
      });
    } catch (error) {
      toast.error("Failed to delete environment");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLaunch = () => {
    navigate({
      to: "/$teamSlugOrId/dashboard",
      params: { teamSlugOrId },
      search: { environmentId },
    });
  };

  const handleEditPorts = () => {
    setIsEditingPorts(true);
    setEditingPorts(environment?.exposedPorts || []);
  };

  const handleCancelEditPorts = () => {
    setIsEditingPorts(false);
    setEditingPorts(environment?.exposedPorts || []);
    setNewPort("");
  };

  const handleAddPort = () => {
    const port = parseInt(newPort);
    if (isNaN(port) || port < 1 || port > 65535) {
      toast.error("Please enter a valid port number (1-65535)");
      return;
    }
    if (editingPorts.includes(port)) {
      toast.error("Port already exists");
      return;
    }
    const reservedPorts = [39376, 39377, 39378];
    if (reservedPorts.includes(port)) {
      toast.error("Cannot expose reserved ports: 39376, 39377, 39378");
      return;
    }
    setEditingPorts([...editingPorts, port].sort((a, b) => a - b));
    setNewPort("");
  };

  const handleRemovePort = (port: number) => {
    setEditingPorts(editingPorts.filter(p => p !== port));
  };

  const handleSavePorts = async () => {
    try {
      await updateEnvironment({
        teamSlugOrId,
        id: environmentId,
        exposedPorts: editingPorts,
      });
      setIsEditingPorts(false);
      toast.success("Exposed ports updated successfully");
    } catch (error) {
      toast.error("Failed to update exposed ports");
      console.error(error);
    }
  };

  return (
    <FloatingPane
      header={<TitleBar title={environment?.name || "Environment Details"} />}
    >
      <div className="p-6">
        {environment ? (
          <div className="space-y-6">
            {/* Back button */}
            <div className="mb-4">
              <Link
                to="/$teamSlugOrId/environments"
                params={{ teamSlugOrId }}
                search={{
                  step: undefined,
                  selectedRepos: undefined,
                  connectionLogin: undefined,
                  repoSearch: undefined,
                  instanceId: undefined,
                }}
                className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Environments
              </Link>
            </div>

            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
                  <Server className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {environment.name}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-500">
                    <Calendar className="w-3 h-3" />
                    Created{" "}
                    {formatDistanceToNow(new Date(environment.createdAt), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleLaunch}
                  className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Launch Environment
                </button>
              </div>
            </div>

            {/* Description */}
            {environment.description && (
              <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  {environment.description}
                </p>
              </div>
            )}

            {/* Details Grid */}
            <div className="space-y-6">
              {/* Repositories */}
              {environment.selectedRepos &&
                environment.selectedRepos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <GitBranch className="w-4 h-4 text-neutral-500" />
                      <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        Repositories ({environment.selectedRepos.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {environment.selectedRepos.map((repo: string) => (
                        <div
                          key={repo}
                          className="flex items-center gap-2 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
                        >
                          <GitBranch className="w-4 h-4 text-neutral-500" />
                          <span className="text-sm text-neutral-700 dark:text-neutral-300">
                            {repo}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Scripts */}
              <div className="space-y-4">
                {environment.devScript && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Terminal className="w-4 h-4 text-neutral-500" />
                      <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        Dev Script
                      </h3>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-900 dark:bg-neutral-950 border border-neutral-800">
                      <code className="text-sm text-green-400 font-mono">
                        {environment.devScript}
                      </code>
                    </div>
                  </div>
                )}

                {environment.maintenanceScript && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Code className="w-4 h-4 text-neutral-500" />
                      <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        Maintenance Script
                      </h3>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-900 dark:bg-neutral-950 border border-neutral-800">
                      <code className="text-sm text-green-400 font-mono">
                        {environment.maintenanceScript}
                      </code>
                    </div>
                  </div>
                )}
              </div>

              {/* Exposed Ports */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-neutral-500" />
                    <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      Exposed Ports
                    </h3>
                  </div>
                  {!isEditingPorts && (
                    <button
                      onClick={handleEditPorts}
                      className="inline-flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                </div>

                {isEditingPorts ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {editingPorts.map((port: number) => (
                        <span
                          key={port}
                          className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-900 px-3 py-1 text-sm text-neutral-700 dark:text-neutral-300"
                        >
                          {port}
                          <button
                            onClick={() => handleRemovePort(port)}
                            className="ml-1 hover:text-red-600 dark:hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="65535"
                        value={newPort}
                        onChange={(e) => setNewPort(e.target.value)}
                        placeholder="Enter port number"
                        className="flex-1 px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddPort();
                          }
                        }}
                      />
                      <button
                        onClick={handleAddPort}
                        className="px-3 py-1 text-sm bg-neutral-900 text-white rounded-md hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSavePorts}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-sm bg-neutral-900 text-white rounded-md hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={handleCancelEditPorts}
                        className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {environment.exposedPorts && environment.exposedPorts.length > 0 ? (
                      environment.exposedPorts.map((port: number) => (
                        <span
                          key={port}
                          className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-900 px-3 py-1 text-sm text-neutral-700 dark:text-neutral-300"
                        >
                          {port}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        No ports exposed
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Technical Details */}
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                  Technical Details
                </h3>
                <dl className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <dt className="text-neutral-500">Environment ID</dt>
                    <dd className="text-neutral-700 dark:text-neutral-300 font-mono text-xs">
                      {environment._id}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-neutral-500">Snapshot ID</dt>
                    <dd className="text-neutral-700 dark:text-neutral-300 font-mono text-xs">
                      {environment.morphSnapshotId}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-neutral-500">Data Vault Key</dt>
                    <dd className="text-neutral-700 dark:text-neutral-300 font-mono text-xs">
                      {environment.dataVaultKey}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-neutral-500">Last Updated</dt>
                    <dd className="text-neutral-700 dark:text-neutral-300">
                      {formatDistanceToNow(new Date(environment.updatedAt), {
                        addSuffix: true,
                      })}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3">
                Danger Zone
              </h3>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-neutral-950 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? "Deleting..." : "Delete Environment"}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
              <Server className="w-8 h-8 text-neutral-400 dark:text-neutral-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              Environment not found
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              The environment you're looking for doesn't exist or has been
              deleted.
            </p>
            <Link
              to="/$teamSlugOrId/environments"
              params={{ teamSlugOrId }}
              search={{
                step: undefined,
                selectedRepos: undefined,
                connectionLogin: undefined,
                repoSearch: undefined,
                instanceId: undefined,
              }}
              className="inline-flex items-center gap-2 rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Environments
            </Link>
          </div>
        )}
      </div>
    </FloatingPane>
  );
}
