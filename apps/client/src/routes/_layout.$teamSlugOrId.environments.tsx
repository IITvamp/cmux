import { env } from "@/client-env";
import { GitHubIcon } from "@/components/icons/github";
import { GitLabIcon } from "@/components/icons/gitlab";
import { Skeleton } from "@/components/ui/skeleton";
import { api, api as convexApi } from "@cmux/convex/api";
import { createFileRoute } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMutation, useQuery } from "convex/react";
import { Check } from "lucide-react";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import type { Selection } from "react-aria-components";

export const Route = createFileRoute("/_layout/$teamSlugOrId/environments")({
  component: EnvironmentsPage,
});

function ConnectionIcon({ type }: { type?: string }) {
  if (type && type.includes("gitlab")) {
    return (
      <GitLabIcon className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
    );
  }
  return (
    <GitHubIcon className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
  );
}

// no ProviderIcon inline; use icon components

function EnvironmentsPage() {
  const { teamSlugOrId } = Route.useParams();
  const reposByOrg = useQuery(api.github.getReposByOrg, { teamSlugOrId });
  const connections = useQuery(api.github.listProviderConnections, {
    teamSlugOrId,
  });
  // Mint signed state for GitHub install
  const mintState = useMutation(convexApi.github_app.mintInstallState);
  const removeConnection = useMutation(api.github.removeProviderConnection);

  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [envName, setEnvName] = useState("");

  const activeConnections = useMemo(
    () => (connections || []).filter((c) => c.isActive !== false),
    [connections]
  );

  const currentOrg = useMemo(() => {
    if (selectedOrg) return selectedOrg;
    if (activeConnections.length > 0)
      return activeConnections[0]?.accountLogin ?? null;
    const keys = reposByOrg ? Object.keys(reposByOrg) : [];
    return keys.length > 0 ? keys[0]! : null;
  }, [selectedOrg, activeConnections, reposByOrg]);

  type RepoLite = {
    fullName: string;
    name: string;
    provider?: string;
    connectionId?: unknown;
    lastSyncedAt?: unknown;
    fullNameLower: string;
    nameLower: string;
  };
  const allRepos = useMemo<RepoLite[]>(() => {
    if (!reposByOrg) return [];
    const groups = Object.values(reposByOrg) as Array<
      Array<{
        fullName: string;
        name: string;
        provider?: string;
        connectionId?: unknown;
        lastSyncedAt?: unknown;
      }>
    >;
    return groups
      .flat()
      .filter(
        (r) => typeof r.fullName === "string" && typeof r.name === "string"
      )
      .map((r) => ({
        fullName: r.fullName,
        name: r.name,
        provider: r.provider,
        connectionId: r.connectionId,
        lastSyncedAt: r.lastSyncedAt,
        fullNameLower: r.fullName.toLowerCase(),
        nameLower: r.name.toLowerCase(),
      }));
  }, [reposByOrg]);

  const deferredSearch = useDeferredValue(search);
  const filteredRepos = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const list = allRepos;
    if (!q) return list;
    return list.filter(
      (r) => r.fullNameLower.includes(q) || r.nameLower.includes(q)
    );
  }, [allRepos, deferredSearch]);

  const [selectedRepos, setSelectedRepos] = useState<Selection>(new Set());
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredRepos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 12,
  });

  const configureUrl = useMemo(() => {
    if (!connections || !currentOrg) return null;
    const match = connections.find(
      (c) => c.accountLogin === currentOrg && c.isActive
    );
    if (!match) return null;
    if (match.accountType === "Organization") {
      return `https://github.com/organizations/${match.accountLogin}/settings/installations/${match.installationId}`;
    }
    return `https://github.com/settings/installations/${match.installationId}`;
  }, [connections, currentOrg]);

  const installNewUrl = env.VITE_GITHUB_APP_SLUG
    ? `https://github.com/apps/${env.VITE_GITHUB_APP_SLUG}/installations/new`
    : null;

  return (
    <div className="flex flex-col w-full h-dvh overflow-auto bg-white dark:bg-black">
      <div className="px-6 pt-6 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Environments
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Configure an environment by selecting a GitHub organization and
          repository.
        </p>
      </div>

      <div className="px-6 py-4 space-y-6">
        {/* Environment name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Environment name
          </label>
          <input
            type="text"
            value={envName}
            onChange={(e) => setEnvName(e.target.value)}
            placeholder="e.g. Production, Staging, Sandbox"
            className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
          />
        </div>

        {/* Connections list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
              Connections
            </label>
            {installNewUrl ? (
              <button
                type="button"
                className="text-xs underline text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
                onClick={async () => {
                  try {
                    const { state } = await mintState({ teamSlugOrId });
                    const sep = installNewUrl.includes("?") ? "&" : "?";
                    const url = `${installNewUrl}${sep}state=${encodeURIComponent(state)}`;
                    window.open(url, "_blank");
                  } catch (e) {
                    console.error("Failed to mint install state:", e);
                    alert("Failed to start installation. Please try again.");
                  }
                }}
              >
                Add organization
              </button>
            ) : null}
          </div>

          {connections === undefined ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 h-9 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-32 rounded-full" />
                    <Skeleton className="h-3 w-14 rounded-full" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <Skeleton className="h-3 w-12 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeConnections.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeConnections.map((c) => {
                const name =
                  c.accountLogin || `installation-${c.installationId}`;
                const cfgUrl =
                  c.accountLogin && c.accountType
                    ? c.accountType === "Organization"
                      ? `https://github.com/organizations/${c.accountLogin}/settings/installations/${c.installationId}`
                      : `https://github.com/settings/installations/${c.installationId}`
                    : null;
                return (
                  <div
                    key={`${c.accountLogin}:${c.installationId}`}
                    className={`rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 h-9 flex items-center justify-between`}
                  >
                    <div className="text-sm text-left text-neutral-800 dark:text-neutral-200 flex items-center gap-2 min-w-0 flex-1">
                      <ConnectionIcon type={c.type} />
                      <span className="truncate">{name}</span>
                      <span className="ml-2 shrink-0 text-[10px] text-neutral-500 dark:text-neutral-500 align-middle">
                        {c.accountType === "Organization"
                          ? "Org"
                          : c.accountType === "User"
                            ? "User"
                            : "Pending"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {cfgUrl ? (
                        <a
                          href={cfgUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
                        >
                          Add repos
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                        onClick={async () => {
                          try {
                            await removeConnection({
                              teamSlugOrId,
                              installationId: c.installationId,
                            });
                            setSelectedOrg(null);
                          } catch (e) {
                            console.error("Failed to remove connection:", e);
                            alert("Failed to remove connection");
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              No provider connections found for this team.
              {installNewUrl ? (
                <>
                  {" "}
                  You can{" "}
                  <a
                    className="underline"
                    href={installNewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    add a GitHub organization
                  </a>
                  .
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Repo search */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Repositories
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories"
            className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
          />

          {/* Repo list as checkmark ListBox */}
          <div className="mt-2 rounded-md border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            {reposByOrg === undefined ? (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-900">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="px-3 h-9 flex items-center justify-between bg-white dark:bg-neutral-950"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Skeleton className="h-4 w-4 rounded-sm" />
                      <Skeleton className="h-4 w-56 rounded" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-8 rounded-full" />
                      <Skeleton className="h-3 w-28 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredRepos.length > 0 ? (
              <div
                ref={parentRef}
                role="listbox"
                aria-multiselectable="true"
                className="max-h-[40vh] overflow-auto relative outline-none"
              >
                <div
                  className="relative w-full"
                  style={{ height: rowVirtualizer.getTotalSize() }}
                >
                  {rowVirtualizer.getVirtualItems().map((vi) => {
                    const r = filteredRepos[vi.index]!;
                    const isSelected = (selectedRepos as Set<string>).has(
                      r.fullName
                    );
                    return (
                      <div
                        key={r.fullName}
                        role="option"
                        aria-selected={isSelected}
                        className={
                          "absolute top-0 left-0 right-0 group px-3 h-9 flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                        }
                        style={{ transform: `translateY(${vi.start}px)` }}
                        onClick={() => {
                          setSelectedRepos((prev) => {
                            const next = new Set(prev as Set<string>);
                            if (next.has(r.fullName)) next.delete(r.fullName);
                            else next.add(r.fullName);
                            return next as unknown as Selection;
                          });
                        }}
                      >
                        <div className="font-medium flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className={`mr-1 h-4 w-4 rounded-sm border grid place-items-center shrink-0 ${
                              isSelected
                                ? "border-neutral-700 bg-neutral-800"
                                : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                            }`}
                          >
                            <Check
                              className={`w-3 h-3 text-white transition-opacity ${
                                isSelected ? "opacity-100" : "opacity-0"
                              }`}
                            />
                          </div>
                          {r.provider === "gitlab" ? (
                            <GitLabIcon className="h-4 w-4 shrink-0 text-neutral-600 dark:text-neutral-300" />
                          ) : (
                            <GitHubIcon className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />
                          )}
                          <span className="truncate">{r.fullName}</span>
                        </div>
                        <div className="ml-3 flex items-center gap-2">
                          {r.connectionId ? (
                            <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 px-2 py-0.5 text-[10px]">
                              App
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 px-2 py-0.5 text-[10px]">
                              Local
                            </span>
                          )}
                          {r.lastSyncedAt ? (
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-500">
                              {new Date(
                                r.lastSyncedAt as number
                              ).toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-3 py-6 text-sm text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-950">
                {search
                  ? "No repositories match your search."
                  : "No repositories in this organization."}
              </div>
            )}
          </div>

          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
            This list only includes repositories that you have access to in
            GitHub and can use with cmux.
            <br />
            Missing a repo?{" "}
            {configureUrl ? (
              <a
                href={configureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                Configure repository access
              </a>
            ) : (
              <span>Configure repository access</span>
            )}
            .
          </p>
        </div>
      </div>
    </div>
  );
}
