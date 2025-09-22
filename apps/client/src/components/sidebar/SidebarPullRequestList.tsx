import { api } from "@cmux/convex/api";
import { Link } from "@tanstack/react-router";
import { useQuery as useConvexQuery } from "convex/react";
import {
  Code2,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Monitor,
} from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";
import { SidebarListItem } from "./SidebarListItem";
import { ContextMenu } from "@base-ui-components/react/context-menu";
import { toast } from "sonner";
import { client as wwwOpenAPIClient } from "@cmux/www-openapi-client/client.gen";
import { SIDEBAR_PRS_DEFAULT_LIMIT } from "./const";

type Props = {
  teamSlugOrId: string;
  limit?: number;
};

export function SidebarPullRequestList({
  teamSlugOrId,
  limit = SIDEBAR_PRS_DEFAULT_LIMIT,
}: Props) {
  const prs = useConvexQuery(api.github_prs.listPullRequests, {
    teamSlugOrId,
    state: "open",
    limit,
  });

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const list = useMemo(() => prs ?? [], [prs]);

  if (prs === undefined) {
    return (
      <ul className="flex flex-col gap-px" aria-label="Loading pull requests">
        {Array.from({ length: limit }).map((_, index) => (
          <li key={index} className="px-2 py-1.5">
            <div className="h-3 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
          </li>
        ))}
      </ul>
    );
  }

  if (list.length === 0) {
    return (
      <p className="mt-1 px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 select-none">
        No pull requests
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-px">
      {list.map((pr) => {
        const [owner = "", repo = ""] = pr.repoFullName?.split("/", 2) ?? [
          "",
          "",
        ];
        const key = `${pr.repoFullName}#${pr.number}`;
        const isExpanded = expanded[key] ?? false;
        const branchLabel = pr.headRef;

        const secondaryParts = [
          branchLabel,
          `${pr.repoFullName}#${pr.number}`,
          pr.authorLogin,
        ]
          .filter(Boolean)
          .map(String);
        const secondary = secondaryParts.join(" • ");
        const leadingIcon = pr.merged ? (
          <GitMerge className="w-3 h-3 text-purple-500" />
        ) : pr.state === "closed" ? (
          <GitPullRequestClosed className="w-3 h-3 text-red-500" />
        ) : pr.draft ? (
          <GitPullRequestDraft className="w-3 h-3 text-neutral-500" />
        ) : (
          <GitPullRequest className="w-3 h-3 text-[#1f883d] dark:text-[#238636]" />
        );

        const actionButtons = [
          {
            key: "vscode",
            label: "VS Code",
            icon: <Code2 className="w-3 h-3" aria-hidden="true" />,
          },
          {
            key: "preview",
            label: "Preview",
            icon: <Monitor className="w-3 h-3" aria-hidden="true" />,
          },
          {
            key: "github",
            label: "GitHub",
            icon: <ExternalLink className="w-3 h-3" aria-hidden="true" />,
          },
        ] as const;

        const handleToggle = (
          _event?: MouseEvent<HTMLButtonElement | HTMLAnchorElement>
        ) => {
          setExpanded((prev) => ({
            ...prev,
            [key]: !isExpanded,
          }));
        };

        const handleClosePr = async () => {
          if (!owner || !repo) return;
          const toastId = toast.loading("Closing PR…");
          try {
            const res = await wwwOpenAPIClient.post({
              url: "/api/integrations/github/prs/close",
              body: {
                team: teamSlugOrId,
                owner,
                repo,
                number: pr.number,
              },
              headers: { "Content-Type": "application/json" },
            });
            if (res.ok) {
              toast.success("PR closed", { id: toastId });
            } else {
              toast.error("Failed to close PR", { id: toastId });
            }
          } catch (e) {
            toast.error("Failed to close PR", { id: toastId });
          }
        };

        return (
          <li key={key} className="rounded-md select-none">
            <ContextMenu.Root>
              <ContextMenu.Trigger>
                <Link
              to="/$teamSlugOrId/prs-only/$owner/$repo/$number"
              params={{
                teamSlugOrId,
                owner,
                repo,
                number: String(pr.number),
              }}
              className="group block"
              onClick={(event) => {
                if (
                  event.defaultPrevented ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }
                handleToggle(event);
              }}
            >
              <SidebarListItem
                paddingLeft={10}
                toggle={{
                  expanded: isExpanded,
                  onToggle: handleToggle,
                  visible: true,
                }}
                title={pr.title}
                titleClassName="text-[13px] text-neutral-950 dark:text-neutral-100"
                secondary={secondary || undefined}
                meta={leadingIcon}
              />
                </Link>
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Positioner className="outline-none z-[var(--z-context-menu)]">
                  <ContextMenu.Popup className="origin-[var(--transform-origin)] rounded-md bg-white dark:bg-neutral-800 py-1 text-neutral-900 dark:text-neutral-100 shadow-lg shadow-gray-200 outline-1 outline-neutral-200 transition-[opacity] data-[ending-style]:opacity-0 dark:shadow-none dark:-outline-offset-1 dark:outline-neutral-700">
                    {pr.state === "open" ? (
                      <ContextMenu.Item
                        className="px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-default"
                        onClick={(e) => {
                          e.preventDefault();
                          handleClosePr();
                        }}
                      >
                        Close PR
                      </ContextMenu.Item>
                    ) : null}
                  </ContextMenu.Popup>
                </ContextMenu.Positioner>
              </ContextMenu.Portal>
            </ContextMenu.Root>
            {isExpanded ? (
              <div
                className="mt-1 flex flex-wrap gap-1.5"
                style={{ paddingLeft: "32px" }}
              >
                {actionButtons.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-[10px] font-medium text-neutral-700 dark:text-neutral-200 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default SidebarPullRequestList;
