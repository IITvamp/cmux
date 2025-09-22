import { api } from "@cmux/convex/api";
import { postApiIntegrationsGithubPrsCloseMutation } from "@cmux/www-openapi-client/react-query";
import { ContextMenu } from "@base-ui-components/react/context-menu";
import { useMutation as useRQMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { useQuery as useConvexQuery } from "convex/react";
import { GitPullRequestClosed, ExternalLink, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Connection = {
  installationId: number;
  accountLogin: string;
};

const CONTEXT_MENU_POPUP_CLASS =
  "origin-[var(--transform-origin)] rounded-md bg-white dark:bg-neutral-800 py-1 text-neutral-900 dark:text-neutral-100 shadow-lg shadow-gray-200 outline-1 outline-neutral-200 transition-[opacity] data-[ending-style]:opacity-0 dark:shadow-none dark:-outline-offset-1 dark:outline-neutral-700";

const CONTEXT_MENU_ITEM_CLASS =
  "flex items-center gap-2 cursor-default py-1.5 pr-8 pl-3 text-[13px] leading-5 outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-white data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm data-[highlighted]:before:bg-neutral-900 dark:data-[highlighted]:before:bg-neutral-700";

const CONTEXT_MENU_ICON_CLASS =
  "w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300";

function formatTimeAgo(input?: number | string): string {
  if (!input) return "";
  const ts = typeof input === "number" ? input : Date.parse(input);
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
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

export function PullRequestListPanel({
  teamSlugOrId,
  activeConnections,
  installationId,
  onInstallationIdChange,
  search,
  onSearchChange,
  state,
  onStateChange,
  selectedKey,
}: {
  teamSlugOrId: string;
  activeConnections: Connection[];
  installationId: number | null;
  onInstallationIdChange: (id: number | null) => void;
  search: string;
  onSearchChange: (text: string) => void;
  state: "open" | "closed" | "all";
  onStateChange: (s: "open" | "closed" | "all") => void;
  selectedKey: string | null;
}) {
  const prs = useConvexQuery(api.github_prs.listPullRequests, {
    teamSlugOrId,
    state,
    search,
  });

  const [pendingCloseKey, setPendingCloseKey] = useState<string | null>(null);
  const closePullRequestMutation = useRQMutation(
    postApiIntegrationsGithubPrsCloseMutation()
  );

  const handleOpenOnGitHub = (url?: string | null) => {
    if (!url) {
      toast.error("No GitHub link available for this pull request.");
      return;
    }
    try {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("Failed to open PR on GitHub", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to open GitHub", { description: message });
    }
  };

  const handleClosePullRequest = (
    key: string,
    owner: string,
    repo: string,
    number: number
  ) => {
    if (closePullRequestMutation.isPending) {
      return;
    }
    if (!owner || !repo) {
      toast.error("Missing repository information for this pull request.");
      return;
    }
    setPendingCloseKey(key);
    closePullRequestMutation.mutate(
      {
        body: {
          team: teamSlugOrId,
          owner,
          repo,
          number,
        },
      },
      {
        onSuccess: () => {
          toast.success("Pull request closed");
        },
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          toast.error("Failed to close pull request", { description: message });
          console.error("[PullRequestListPanel] close pull request failed", error);
        },
        onSettled: () => {
          setPendingCloseKey((current) => (current === key ? null : current));
        },
      }
    );
  };

  const list = useMemo(() => {
    const rows = prs || [];
    if (installationId) {
      return rows.filter((p) => p.installationId === installationId);
    }
    return rows;
  }, [prs, installationId]);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 items-center h-[57px]">
        <select
          className="flex-0 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 px-2 py-1 text-sm"
          value={installationId ?? ""}
          onChange={(e) =>
            onInstallationIdChange(Number(e.target.value) || null)
          }
        >
          {activeConnections.map((c) => (
            <option key={c.installationId} value={c.installationId}>
              {c.accountLogin}
            </option>
          ))}
        </select>
        <input
          placeholder="Search PRs"
          className="flex-1 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 px-2 py-1 text-sm"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <select
          className="flex-0 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 px-2 py-1 text-sm"
          value={state}
          onChange={(e) => onStateChange(e.target.value as typeof state)}
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!prs ? (
          <div className="p-4 text-neutral-500">Loading…</div>
        ) : list.length === 0 ? (
          <div className="p-4 text-neutral-500">No pull requests found</div>
        ) : (
          <ul className="flex flex-col gap-0.5 py-1">
            {list.map((pr) => {
              const [owner = "", repo = ""] = pr.repoFullName.split("/", 2);
              const key = `${pr.repoFullName}#${pr.number}`;
              const isSelected = selectedKey === key;
              const isClosing =
                pendingCloseKey === key && closePullRequestMutation.isPending;
              const canClose = pr.state === "open" && !pr.merged;
              const hasGithubLink = Boolean(pr.htmlUrl);
              const hasMenu = canClose || hasGithubLink;
              return (
                <li key={key} className="">
                  <ContextMenu.Root>
                    <ContextMenu.Trigger>
                      <Link
                        to="/$teamSlugOrId/prs/$owner/$repo/$number"
                        params={{
                          teamSlugOrId,
                          owner,
                          repo,
                          number: String(pr.number),
                        }}
                        className={clsx("block px-1 cursor-default")}
                      >
                        <div
                          className={clsx(
                            "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 dark:bg-neutral-800/50 px-4 py-2 rounded-md",
                            isSelected && "bg-neutral-200/50 dark:bg-neutral-800/50"
                          )}
                        >
                          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                            {pr.title}
                          </div>
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                            {pr.repoFullName}#{pr.number} • {pr.authorLogin || ""} •{" "}
                            {formatTimeAgo(pr.updatedAt)}
                          </div>
                        </div>
                      </Link>
                    </ContextMenu.Trigger>
                    {hasMenu ? (
                      <ContextMenu.Portal>
                        <ContextMenu.Positioner className="outline-none z-[var(--z-context-menu)]">
                          <ContextMenu.Popup className={CONTEXT_MENU_POPUP_CLASS}>
                            {canClose ? (
                              <ContextMenu.Item
                                className={CONTEXT_MENU_ITEM_CLASS}
                                onClick={() =>
                                  handleClosePullRequest(key, owner, repo, pr.number)
                                }
                              >
                                {isClosing ? (
                                  <Loader2
                                    className={`${CONTEXT_MENU_ICON_CLASS} animate-spin`}
                                  />
                                ) : (
                                  <GitPullRequestClosed
                                    className={CONTEXT_MENU_ICON_CLASS}
                                  />
                                )}
                                <span>Close pull request</span>
                              </ContextMenu.Item>
                            ) : null}
                            {hasGithubLink ? (
                              <ContextMenu.Item
                                className={CONTEXT_MENU_ITEM_CLASS}
                                onClick={() => handleOpenOnGitHub(pr.htmlUrl)}
                              >
                                <ExternalLink className={CONTEXT_MENU_ICON_CLASS} />
                                <span>Open on GitHub</span>
                              </ContextMenu.Item>
                            ) : null}
                          </ContextMenu.Popup>
                        </ContextMenu.Positioner>
                      </ContextMenu.Portal>
                    ) : null}
                  </ContextMenu.Root>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default PullRequestListPanel;
