import { GitDiffViewer } from "@/components/git-diff-viewer";
import { api } from "@cmux/convex/api";
import { type ReplaceDiffEntry } from "@cmux/shared/diff-types";
import { getApiIntegrationsGithubPrsCodeOptions } from "@cmux/www-openapi-client/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery as useConvexQuery } from "convex/react";
import { useMemo } from "react";

function formatTimeAgo(input?: number): string {
  if (!input) return "";
  const diff = Date.now() - input;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(mo / 12);
  return `${yr}y ago`;
}

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/prs/$owner/$repo/$number"
)({
  component: PRDetails,
  loader: async (opts) => {
    const { teamSlugOrId, owner, repo, number } = opts.params;
    void opts.context.queryClient.ensureQueryData(
      getApiIntegrationsGithubPrsCodeOptions({
        query: {
          team: teamSlugOrId,
          owner,
          repo,
          number: Number(number),
          includeContents: true,
          includePatch: true,
          maxFileBytes: 500000,
          maxPages: 10,
        },
      })
    );
  },
});

function PRDetails() {
  const { teamSlugOrId, owner, repo, number } = Route.useParams();
  const prs = useConvexQuery(api.github_prs.listPullRequests, {
    teamSlugOrId,
    state: "all",
  });
  const target = useMemo(() => {
    const key = `${owner}/${repo}`;
    const num = Number(number);
    return (
      (prs || []).find((p) => p.repoFullName === key && p.number === num) ||
      null
    );
  }, [prs, owner, repo, number]);

  const codeQuery = useQuery({
    ...getApiIntegrationsGithubPrsCodeOptions({
      query: {
        team: teamSlugOrId,
        owner,
        repo,
        number: Number(number),
        includeContents: true,
        includePatch: true,
        maxFileBytes: 500000,
        maxPages: 10,
      },
    }),
    enabled: !!target,
  });

  const diffs = useMemo<ReplaceDiffEntry[]>(() => {
    const data = codeQuery.data;
    if (!data) return [];
    const decodeBase64 = (b64?: string): string => {
      if (!b64) return "";
      try {
        // Decode base64 safely to UTF-8
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder().decode(bytes);
      } catch {
        try {
          return atob(b64);
        } catch {
          return "";
        }
      }
    };
    return (data.files || []).map((f) => {
      const status =
        f.status === "removed"
          ? ("deleted" as const)
          : f.status === "modified"
            ? ("modified" as const)
            : f.status === "renamed"
              ? ("renamed" as const)
              : ("added" as const);
      const oldContent = decodeBase64(f.baseContents?.content);
      const newContent = decodeBase64(f.contents?.content);
      const entry: ReplaceDiffEntry = {
        filePath: f.filename,
        oldPath: f.previous_filename ?? undefined,
        status,
        additions: f.additions ?? 0,
        deletions: f.deletions ?? 0,
        patch: f.patch,
        oldContent: status === "added" ? "" : oldContent,
        newContent: status === "deleted" ? "" : newContent,
        isBinary:
          // Heuristic: if neither side has content and patch absent, treat as binary/omitted
          (!f.contents && !f.baseContents && !f.patch) || false,
        contentOmitted: Boolean(
          (f.truncated && !f.contents) || (f.truncatedBase && !f.baseContents)
        ),
        oldSize: f.sizeBase,
        newSize: f.size,
        patchSize: f.patch ? f.patch.length : undefined,
      };
      return entry;
    });
  }, [codeQuery.data]);

  if (!target) {
    return (
      <div className="h-full w-full flex items-center justify-center text-neutral-500 dark:text-neutral-400">
        PR not found
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {target.title}
        </h2>
        <div className="flex items-center gap-2">
          {target.draft ? (
            <span className="text-xs px-2 py-1 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
              Draft
            </span>
          ) : null}
          {target.merged ? (
            <span className="text-xs px-2 py-1 rounded-md bg-purple-200 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200">
              Merged
            </span>
          ) : target.state === "closed" ? (
            <span className="text-xs px-2 py-1 rounded-md bg-red-200 dark:bg-red-900/40 text-red-900 dark:text-red-200">
              Closed
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-md bg-green-200 dark:bg-green-900/40 text-green-900 dark:text-green-200">
              Open
            </span>
          )}
          {target.htmlUrl ? (
            <a
              className="text-xs px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              href={target.htmlUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open on GitHub
            </a>
          ) : null}
        </div>
      </div>
      <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {target.repoFullName}#{target.number} • {target.authorLogin || ""}
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-neutral-500 dark:text-neutral-400">Branches</div>
          <div className="text-neutral-900 dark:text-neutral-100">
            {target.headRef || "?"} → {target.baseRef || "?"}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-neutral-500 dark:text-neutral-400">Updated</div>
          <div className="text-neutral-900 dark:text-neutral-100">
            {formatTimeAgo(target.updatedAt)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-neutral-500 dark:text-neutral-400">Created</div>
          <div className="text-neutral-900 dark:text-neutral-100">
            {formatTimeAgo(target.createdAt)}
          </div>
        </div>
        {target.mergedAt ? (
          <div className="space-y-1">
            <div className="text-neutral-500 dark:text-neutral-400">Merged</div>
            <div className="text-neutral-900 dark:text-neutral-100">
              {formatTimeAgo(target.mergedAt)}
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
          <div className="text-neutral-500 dark:text-neutral-400">Commits</div>
          <div className="text-neutral-900 dark:text-neutral-100 font-medium">
            {target.commitsCount ?? "-"}
          </div>
        </div>
        <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
          <div className="text-neutral-500 dark:text-neutral-400">Files</div>
          <div className="text-neutral-900 dark:text-neutral-100 font-medium">
            {target.changedFiles ?? "-"}
          </div>
        </div>
        <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
          <div className="text-neutral-500 dark:text-neutral-400">+ / -</div>
          <div className="text-neutral-900 dark:text-neutral-100 font-medium">
            {target.additions ?? 0} / {target.deletions ?? 0}
          </div>
        </div>
      </div>
      <div className="mt-6">
        {codeQuery.isLoading ? (
          <div className="text-neutral-500 dark:text-neutral-400 text-sm">
            Loading diffs…
          </div>
        ) : codeQuery.isError ? (
          <div className="text-red-600 dark:text-red-400 text-sm">
            Failed to load diffs
          </div>
        ) : diffs.length === 0 ? (
          <div className="text-neutral-500 dark:text-neutral-400 text-sm">
            No file changes
          </div>
        ) : (
          <GitDiffViewer diffs={diffs} />
        )}
      </div>
    </div>
  );
}
