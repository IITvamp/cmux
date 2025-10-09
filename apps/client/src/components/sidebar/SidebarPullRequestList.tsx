import { VSCodeIcon } from "@/components/icons/VSCodeIcon";
import { GitHubIcon } from "@/components/icons/github";
import { api } from "@cmux/convex/api";
import { Link } from "@tanstack/react-router";
import { useQuery as useConvexQuery } from "convex/react";
import {
  ExternalLink,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from "lucide-react";
import { useMemo, useState, type ComponentType, type MouseEvent } from "react";
import { SidebarListItem } from "./SidebarListItem";
import { SIDEBAR_PRS_DEFAULT_LIMIT } from "./const";
import type { Doc } from "@cmux/convex/dataModel";

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

  console.log("[SidebarPullRequestList]", {
    teamSlugOrId,
    prsUndefined: prs === undefined,
    prsLength: prs?.length,
    prs,
  });

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
      <p className="mt-1 pl-2 pr-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 select-none">
        No pull requests
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-px">
      {list.map((pr) => (
        <PullRequestListItem
          key={`${pr.repoFullName}#${pr.number}`}
          pr={pr}
          teamSlugOrId={teamSlugOrId}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      ))}
    </ul>
  );
}

type PullRequestListItemProps = {
  pr: Doc<"pullRequests">;
  teamSlugOrId: string;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
};

function PullRequestListItem({ pr, teamSlugOrId, expanded, setExpanded }: PullRequestListItemProps) {
  // Query deployments for this PR to get Preview URL
  const deployments = useConvexQuery(api.github_deployments.getDeploymentsForPr, {
    teamSlugOrId,
    repoFullName: pr.repoFullName,
    prNumber: pr.number,
    headSha: pr.headSha,
    limit: 10,
  });

  const [owner = "", repo = ""] = pr.repoFullName?.split("/", 2) ?? ["", ""];
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

  // Find all Preview deployments (environment_url from Preview deployments)
  const previewDeployments = (deployments ?? []).filter(d => d.environment === 'Preview');

  const [previewExpanded, setPreviewExpanded] = useState(false);

  const actionButtons: ReadonlyArray<{
    key: string;
    label: string;
    icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    href?: string;
    hasChildren?: boolean;
  }> = [
    {
      key: "vscode",
      label: "VS Code",
      icon: VSCodeIcon,
    },
    {
      key: "preview",
      label: "Preview",
      icon: ExternalLink,
      hasChildren: previewDeployments.length > 0,
    },
    {
      key: "github",
      label: "GitHub",
      icon: GitHubIcon,
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
              <div className="mt-px flex flex-col" role="group">
                {actionButtons.map((action) => {
                  const Icon = action.icon;
                  const Element = action.href ? 'a' : 'button';
                  const elementProps = action.href ? {
                    href: action.href,
                    target: "_blank",
                    rel: "noreferrer",
                  } : {
                    type: "button" as const,
                  };

                  return (
                    <div key={action.key}>
                      <Element
                        {...elementProps}
                        onClick={(event) => {
                          if (action.key === 'preview' && action.hasChildren) {
                            event.preventDefault();
                            event.stopPropagation();
                            setPreviewExpanded(prev => !prev);
                          } else if (!action.href) {
                            event.preventDefault();
                            event.stopPropagation();
                          } else {
                            event.stopPropagation();
                          }
                        }}
                        className="mt-px flex w-full items-center rounded-md pr-2 py-1 text-xs transition-colors hover:bg-neutral-200/45 dark:hover:bg-neutral-800/45 cursor-default"
                        style={{ paddingLeft: "32px" }}
                      >
                        <Icon
                          className="mr-2 h-3 w-3 text-neutral-400 grayscale opacity-60"
                          aria-hidden
                        />
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {action.label}
                        </span>
                      </Element>
                      {action.key === 'preview' && previewExpanded && previewDeployments.length > 0 && (
                        <div className="flex flex-col">
                          {previewDeployments.map((dep, idx) => (
                            <a
                              key={`preview-${idx}`}
                              href={dep.environmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              className="mt-px flex w-full items-center rounded-md pr-2 py-1 text-xs transition-colors hover:bg-neutral-200/45 dark:hover:bg-neutral-800/45"
                              style={{ paddingLeft: "48px" }}
                            >
                              <ExternalLink
                                className="mr-2 h-3 w-3 text-neutral-400 grayscale opacity-60"
                                aria-hidden
                              />
                              <span className="text-neutral-600 dark:text-neutral-400 truncate">
                                {dep.description || `Preview ${idx + 1}`}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
    </li>
  );
}

export default SidebarPullRequestList;
