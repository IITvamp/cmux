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
            icon: <Code2 className="w-3 h-3 mr-2 text-neutral-400" aria-hidden="true" />,
            type: "button" as const,
          },
          {
            key: "preview",
            label: "Preview",
            icon: <Monitor className="w-3 h-3 mr-2 text-neutral-400" aria-hidden="true" />,
            type: "button" as const,
          },
          {
            key: "github",
            label: "GitHub",
            icon: <ExternalLink className="w-3 h-3 mr-2 text-neutral-400" aria-hidden="true" />,
            type: "link" as const,
            href: pr.htmlUrl,
          },
        ];

        const handleToggle = (
          _event?: MouseEvent<HTMLButtonElement | HTMLAnchorElement>
        ) => {
          setExpanded((prev) => ({
            ...prev,
            [key]: !isExpanded,
          }));
        };

        return (
          <li key={key} className="rounded-md select-none">
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
            {isExpanded ? (
              <div className="mt-1 flex flex-col" style={{ paddingLeft: "32px" }}>
                {actionButtons.map((action) => {
                  const content = (
                    <div
                      className="flex items-center px-2 py-1 text-xs rounded-md hover:bg-neutral-200/45 dark:hover:bg-neutral-800/45 cursor-default mt-px"
                      onClick={(event) => {
                        // Prevent toggling the parent link
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                    >
                      {action.icon}
                      <span className="text-neutral-600 dark:text-neutral-400">{action.label}</span>
                    </div>
                  );

                  if (action.type === "link" && action.href) {
                    return (
                      <a
                        key={action.key}
                        href={action.href}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                        onClick={(event) => {
                          // Allow opening in new tab normally but avoid toggling the PR row
                          event.stopPropagation();
                        }}
                      >
                        {content}
                      </a>
                    );
                  }

                  return (
                    <button key={action.key} type="button" className="block w-full">
                      {content}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default SidebarPullRequestList;
