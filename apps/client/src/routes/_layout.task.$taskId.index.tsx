import { api } from "@cmux/convex/api";
import { type Id } from "@cmux/convex/dataModel";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MergeActionButton, type MergeStrategy } from "@/components/MergeActionButton";
import { Copy, GitBranch, Link as LinkIcon, Loader2, SquareArrowOutUpRight } from "lucide-react";
import { toast } from "sonner";

// Lazy-load Monaco editor to keep initial bundle light
import { DiffEditor } from "@monaco-editor/react";

type DiffFileItem = {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "copied";
  additions: number;
  deletions: number;
  oldUrl?: string;
  newUrl?: string;
};

export const Route = createFileRoute("/_layout/task/$taskId/")({
  component: TaskDetailPage,
  loader: async (opts) => {
    await Promise.all([
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.taskRuns.getByTask, {
          taskId: opts.params.taskId as Id<"tasks">,
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.tasks.getById, {
          id: opts.params.taskId as Id<"tasks">,
        })
      ),
    ]);
  },
});

function TaskDetailPage() {
  const { taskId } = Route.useParams();

  // Base task info
  const { data: task } = useSuspenseQuery(
    convexQuery(api.tasks.getById, { id: taskId as Id<"tasks"> })
  );

  // Repo info by full name if available
  const { data: repo } = useSuspenseQuery(
    convexQuery(api.github.getRepoByFullName, {
      fullName: (task?.projectFullName as string) || "",
    })
  );

  // Latest diff snapshot
  const { data: snapshot, refetch: refetchSnapshot } = useSuspenseQuery(
    convexQuery(api.diffs.getLatestByTask, { taskId: taskId as Id<"tasks"> })
  );

  // PR if known
  const { data: pr } = useSuspenseQuery(
    convexQuery(api.github.getPullRequestForTask, { taskId: taskId as Id<"tasks"> })
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [mode, setMode] = useState<"pr" | "merge">(pr ? "merge" : "pr");

  useEffect(() => {
    // On load, request a diff refresh and show subtle loader
    let cancelled = false;
    const run = async () => {
      try {
        setIsUpdating(true);
        // In a real system, a worker updates the snapshot.
        // Here we just refetch to pick up status on mount.
        await refetchSnapshot();
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setIsUpdating(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [taskId, task?.branch, task?.projectFullName, repo?.gitRemote, refetchSnapshot]);

  useEffect(() => {
    setMode(pr ? "merge" : "pr");
  }, [pr]);

  const branchName = (task?.branch as string) || "";
  const repoUrl = useMemo(() => {
    if (repo?.gitRemote) return repo.gitRemote;
    if (task?.projectFullName) return `https://github.com/${task.projectFullName}`;
    return undefined;
  }, [repo?.gitRemote, task?.projectFullName]);

  const onCopyBranch = async () => {
    if (!branchName) return;
    await navigator.clipboard.writeText(branchName);
    toast.success("Branch copied");
  };

  const handleOpenPr = async () => {
    // TODO: wire to server to create draft PR if missing. For now, just notify.
    toast.message("Requesting draft PR…");
    // After creation, switch to merge mode.
    setMode("merge");
  };

  const handleMerge = async (strategy: MergeStrategy) => {
    // TODO: call backend to merge with selected strategy
    toast.message(
      strategy === "squash"
        ? "Squashing and merging…"
        : strategy === "rebase"
        ? "Rebasing and merging…"
        : "Creating merge commit…"
    );
  };

  const handleViewPr = () => {
    const url = pr?.url;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    // If no PR, attempt to open after requesting draft
    void handleOpenPr();
  };

  return (
    <div className="flex flex-col grow min-h-0 border-l border-neutral-200 dark:border-neutral-800">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {task?.text || "Review changes"}
          </div>
          {isUpdating && (
            <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating diffs…
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm">
            {branchName && (
              <button className="flex items-center gap-1 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100" onClick={onCopyBranch} title="Click to copy branch">
                <GitBranch className="h-4 w-4" />
                <span className="underline decoration-dotted underline-offset-2">
                  {branchName}
                </span>
                <Copy className="h-3.5 w-3.5 opacity-70" />
              </button>
            )}
            {repoUrl && (
              <a
                className="flex items-center gap-1 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
                href={repoUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <LinkIcon className="h-4 w-4" />
                <span className="truncate max-w-[28ch]">{repoUrl}</span>
                <SquareArrowOutUpRight className="h-3.5 w-3.5 opacity-70" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <MergeActionButton
              mode={mode}
              onOpenPr={handleOpenPr}
              onMerge={handleMerge}
              defaultStrategy="squash"
            />
            <Button variant="outline" onClick={handleViewPr} className="gap-1">
              View PR
            </Button>
          </div>
        </div>
      </div>

      {/* Body: Monaco-based diff list */}
      <div className="grow min-h-0 overflow-auto">
        {snapshot && snapshot.files.length > 0 ? (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {snapshot.files.map((f: DiffFileItem, idx: number) => (
              <FileDiffItem key={`${f.path}-${idx}`} file={f} />
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            No changes to display yet.
          </div>
        )}
      </div>
    </div>
  );
}

function FileDiffItem({ file }: { file: DiffFileItem }) {
  const [original, setOriginal] = useState<string>("");
  const [modified, setModified] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [o, m] = await Promise.all([
          file.oldUrl ? fetch(file.oldUrl).then((r) => r.text()) : Promise.resolve(""),
          file.newUrl ? fetch(file.newUrl).then((r) => r.text()) : Promise.resolve(""),
        ]);
        if (!cancelled) {
          setOriginal(o);
          setModified(m);
        }
      } catch (err) {
        console.error("Failed to load diff file contents", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [file.oldUrl, file.newUrl]);

  return (
    <div className="py-3">
      <div className="px-4 pb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
          {file.path}
        </div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          {file.status} · +{file.additions} −{file.deletions}
        </div>
      </div>
      <div className="h-[360px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
            Loading…
          </div>
        ) : (
          <DiffEditor
            height="100%"
            theme="vs-dark"
            original={original}
            modified={modified}
            options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false } }}
          />
        )}
      </div>
    </div>
  );
}
