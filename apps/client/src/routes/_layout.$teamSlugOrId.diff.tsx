import { GitDiffViewer } from "@/components/git-diff-viewer";
import { GitHubIcon } from "@/components/icons/github";
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/searchable-select";
import { useSocket } from "@/contexts/socket/use-socket";
import { branchesQueryOptions } from "@/queries/branches";
import { diffSmartQueryOptions } from "@/queries/diff-smart";
import { api } from "@cmux/convex/api";
import { convexQuery } from "@convex-dev/react-query";
import {
  loadRecentProjects,
  sortReposByRecency,
  touchRecentProject,
  type RecentProjectsMap,
} from "@/lib/recentProjects";
import type { Doc } from "@cmux/convex/dataModel";
import { useQuery as useRQ } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeftRight, GitBranch } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/$teamSlugOrId/diff")({
  component: DashboardDiffPage,
});

type DiffSearch = {
  ref1?: string;
  ref2?: string;
};

function DashboardDiffPage() {
  const { teamSlugOrId } = Route.useParams();
  const search = Route.useSearch() as DiffSearch;
  const router = useRouter();
  const { socket } = useSocket();

  const [selectedProject, setSelectedProject] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem("selectedProject");
      const parsed = stored ? (JSON.parse(stored) as string[]) : [];
      return parsed[0] || null;
    } catch {
      return null;
    }
  });
  const [recentProjects, setRecentProjects] = useState<RecentProjectsMap>(() =>
    loadRecentProjects()
  );
  const recordRecentProject = useCallback(
    (fullName?: string | null) => {
      if (!fullName || fullName.startsWith("env:")) return;
      setRecentProjects((prev) => touchRecentProject(prev, fullName));
    },
    [touchRecentProject]
  );

  useEffect(() => {
    if (!selectedProject || selectedProject.startsWith("env:")) return;
    setRecentProjects((prev) => {
      if (prev[selectedProject]) return prev;
      return touchRecentProject(prev, selectedProject);
    });
  }, [selectedProject, touchRecentProject]);

  useEffect(() => {
    if (selectedProject) return;
    const onDefaultRepo = (payload: unknown) => {
      const data = payload as { repoFullName: string; branch?: string };
      if (!data || typeof data.repoFullName !== "string") return;
      setSelectedProject(data.repoFullName);
      localStorage.setItem(
        "selectedProject",
        JSON.stringify([data.repoFullName])
      );
      recordRecentProject(data.repoFullName);
    };
    // Rely on SocketProvider attaching a socket to window if available
    const w = window as unknown as {
      cmuxSocket?: {
        on: (event: string, cb: (data: unknown) => void) => void;
        off: (event: string, cb: (data: unknown) => void) => void;
      };
    };
    if (w.cmuxSocket && typeof w.cmuxSocket.on === "function") {
      w.cmuxSocket.on("default-repo", onDefaultRepo);
      return () => {
        w.cmuxSocket?.off?.("default-repo", onDefaultRepo);
      };
    }
    return () => {};
  }, [selectedProject, recordRecentProject]);

  const reposByOrgQuery = useRQ(
    convexQuery(api.github.getReposByOrg, { teamSlugOrId })
  );

  const branchesQuery = useRQ(
    branchesQueryOptions({
      teamSlugOrId,
      repoFullName: selectedProject || "",
    })
  );

  const projectOptions: SelectOption[] = useMemo(() => {
    const byOrg =
      (reposByOrgQuery.data as Record<string, Doc<"repos">[]> | undefined) ||
      {};
    const repoMap = new Map<string, Doc<"repos">>();
    Object.values(byOrg).forEach((repos) => {
      repos.forEach((repo) => {
        const existing = repoMap.get(repo.fullName);
        if (!existing) {
          repoMap.set(repo.fullName, repo);
          return;
        }
        const currentSynced = existing.lastSyncedAt ?? 0;
        const nextSynced = repo.lastSyncedAt ?? 0;
        if (nextSynced > currentSynced) {
          repoMap.set(repo.fullName, repo);
        }
      });
    });
    const repoOptions = sortReposByRecency(
      Array.from(repoMap.values()),
      recentProjects
    ).map((repo) => ({
      label: repo.fullName,
      value: repo.fullName,
      icon: (
        <GitHubIcon className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
      ),
      iconKey: "github",
    }));
    const opts: SelectOption[] = [];
    if (repoOptions.length > 0) {
      opts.push({
        label: "Repositories",
        value: "__heading-repo",
        heading: true,
      });
      opts.push(...repoOptions);
    }
    return opts;
  }, [reposByOrgQuery.data, recentProjects]);

  const branchOptions: SelectOption[] = useMemo(() => {
    const b = (branchesQuery.data || []) as string[];
    // Avoid duplicate icons by not adding per-option icons; use leftIcon on control instead
    return b.map((name) => ({ label: name, value: name }));
  }, [branchesQuery.data]);

  const setSearch = useCallback(
    (next: Partial<DiffSearch>) => {
      void router.navigate({
        to: "/$teamSlugOrId/diff",
        params: { teamSlugOrId },
        search: {
          ref1: next.ref1 ?? search.ref1,
          ref2: next.ref2 ?? search.ref2,
        },
        replace: true,
      });
    },
    [router, teamSlugOrId, search.ref1, search.ref2]
  );

  const onChangeRef1 = useCallback(
    (vals: string[]) => {
      setSearch({ ref1: vals[0] });
    },
    [setSearch]
  );
  const onChangeRef2 = useCallback(
    (vals: string[]) => {
      setSearch({ ref2: vals[0] });
    },
    [setSearch]
  );

  const swapRefs = useCallback(() => {
    setSearch({ ref1: search.ref2, ref2: search.ref1 });
  }, [search.ref1, search.ref2, setSearch]);

  const bothSelected = !!search.ref1 && !!search.ref2 && !!selectedProject;
  const diffsQuery = useRQ(
    selectedProject && search.ref1 && search.ref2
      ? diffSmartQueryOptions({
          repoFullName: selectedProject,
          baseRef: search.ref1,
          headRef: search.ref2,
        })
      : { queryKey: ["diff-smart-disabled"], queryFn: async () => [] }
  );

  // Smart view: no toggle logic needed

  useEffect(() => {
    if (diffsQuery.isError) {
      const err = diffsQuery.error as unknown;
      const msg = err instanceof Error ? err.message : String(err ?? "");
      toast.error("Failed to load diffs", { description: msg });
    }
  }, [diffsQuery.isError, diffsQuery.error]);

  // On socket connect, kick a refetch if we have required selections
  useEffect(() => {
    if (socket && bothSelected) {
      void diffsQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, bothSelected]);

  return (
    <div className="flex flex-col h-screen min-h-0 grow">
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 flex items-center gap-2">
        <SearchableSelect
          options={projectOptions}
          value={selectedProject ? [selectedProject] : []}
          onChange={(vals) => {
            const v = vals[0];
            setSelectedProject(v ?? null);
            localStorage.setItem(
              "selectedProject",
              JSON.stringify(v ? [v] : [])
            );
            // Clear refs when repo changes
            setSearch({ ref1: undefined, ref2: undefined });
            recordRecentProject(v);
          }}
          placeholder="Select repository"
          singleSelect
          className="h-8"
          loading={reposByOrgQuery.isLoading}
        />
        <SearchableSelect
          options={branchOptions}
          value={search.ref1 ? [search.ref1] : []}
          onChange={onChangeRef1}
          placeholder="Select ref 1"
          singleSelect
          leftIcon={<GitBranch className="h-3.5 w-3.5 text-neutral-500" />}
          className="h-8"
          disabled={!selectedProject}
          loading={branchesQuery.isLoading}
        />
        <button
          type="button"
          onClick={swapRefs}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900"
          aria-label="Swap refs"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <SearchableSelect
          options={branchOptions}
          value={search.ref2 ? [search.ref2] : []}
          onChange={onChangeRef2}
          placeholder="Select ref 2"
          singleSelect
          leftIcon={<GitBranch className="h-3.5 w-3.5 text-neutral-500" />}
          className="h-8"
          disabled={!selectedProject}
          loading={branchesQuery.isLoading}
        />
      </div>
      <div className="flex-1 flex flex-col bg-white dark:bg-neutral-950 overflow-y-auto grow">
        {/* Smart view: no toggle */}
        <GitDiffViewer
          diffs={diffsQuery.data || []}
          onControlsChange={() => {}}
        />
        {!bothSelected ? (
          <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
            Select a repository and two refs to compare.
          </div>
        ) : null}
      </div>
    </div>
  );
}
