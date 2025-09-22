import { api } from "@cmux/convex/api";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { useQuery as useConvexQuery } from "convex/react";
import { useMemo, useState, useCallback } from "react";
import { DropdownParts } from "@/components/ui/dropdown.parts";
import { X, ExternalLink, GitPullRequest } from "lucide-react";
import { isElectron } from "@/lib/electron";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Connection = {
  installationId: number;
  accountLogin: string;
};

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
  const queryClient = useQueryClient();
  const [closingPRs, setClosingPRs] = useState<Set<string>>(new Set());
  const prs = useConvexQuery(api.github_prs.listPullRequests, {
    teamSlugOrId,
    state,
    search,
  });

  const list = useMemo(() => {
    const rows = prs || [];
    if (installationId) {
      return rows.filter((p) => p.installationId === installationId);
    }
    return rows;
  }, [prs, installationId]);

  const handleClosePR = useCallback(
    async (owner: string, repo: string, number: number) => {
      const key = `${owner}/${repo}#${number}`;
      setClosingPRs((prev) => new Set(prev).add(key));

      try {
        const response = await fetch("/api/integrations/github/prs/close", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            team: teamSlugOrId,
            owner,
            repo,
            number,
          }),
        });

        const data = await response.json();
        if (data.success) {
          toast.success(`Closed PR #${number}`);
          // Refetch the PR list
          queryClient.invalidateQueries();
        } else {
          toast.error(data.message || "Failed to close PR");
        }
      } catch (error) {
        toast.error("Failed to close PR");
        console.error("Error closing PR:", error);
      } finally {
        setClosingPRs((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [teamSlugOrId, queryClient]
  );

  const handleOpenInGitHub = useCallback((url: string) => {
    if (isElectron && window.cmux?.rpc) {
      // Use Electron's shell.openExternal through IPC
      window.cmux.rpc("openExternal", url);
    } else {
      // Fallback to window.open for web
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

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
              const [owner, repo] = pr.repoFullName.split("/", 2);
              const isSelected =
                selectedKey === `${pr.repoFullName}#${pr.number}`;
              const prKey = `${owner}/${repo}#${pr.number}`;
              const isClosing = closingPRs.has(prKey);
              const githubUrl = `https://github.com/${owner}/${repo}/pull/${pr.number}`;

              return (
                <li key={`${pr.repoFullName}#${pr.number}`} className="">
                  <DropdownParts.Root>
                    <DropdownParts.Trigger asChild>
                      <div className="block px-1">
                        <Link
                          to="/$teamSlugOrId/prs/$owner/$repo/$number"
                          params={{
                            teamSlugOrId,
                            owner: owner || "",
                            repo: repo || "",
                            number: String(pr.number),
                          }}
                          className="block cursor-default"
                          onContextMenu={(e) => {
                            e.preventDefault();
                            // Trigger the dropdown menu
                            const trigger = e.currentTarget.parentElement as HTMLElement;
                            trigger?.click();
                          }}
                        >
                          <div
                            className={clsx(
                              "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 dark:bg-neutral-800/50 px-4 py-2 rounded-md",
                              isSelected && "bg-neutral-200/50 dark:bg-neutral-800/50",
                              isClosing && "opacity-50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <GitPullRequest className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
                              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                {pr.title}
                              </div>
                            </div>
                            <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 pl-5">
                              {pr.repoFullName}#{pr.number} • {pr.authorLogin || ""} •{" "}
                              {formatTimeAgo(pr.updatedAt)}
                            </div>
                          </div>
                        </Link>
                      </div>
                    </DropdownParts.Trigger>
                    <DropdownParts.Portal>
                      <DropdownParts.Positioner>
                        <DropdownParts.Popup>
                          <DropdownParts.Item
                            onClick={() => handleOpenInGitHub(githubUrl)}
                            className="flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Open in GitHub</span>
                          </DropdownParts.Item>
                          {pr.state === "open" && (
                            <DropdownParts.Item
                              onClick={() => {
                                if (owner && repo) {
                                  handleClosePR(owner, repo, pr.number);
                                }
                              }}
                              disabled={isClosing}
                              className="flex items-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              <span>{isClosing ? "Closing..." : "Close PR"}</span>
                            </DropdownParts.Item>
                          )}
                        </DropdownParts.Popup>
                      </DropdownParts.Positioner>
                    </DropdownParts.Portal>
                  </DropdownParts.Root>
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
