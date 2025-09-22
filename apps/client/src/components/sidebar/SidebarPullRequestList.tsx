import { api } from "@cmux/convex/api";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { useQuery as useConvexQuery } from "convex/react";
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

  if (prs === undefined) {
    return (
      <ul className="flex flex-col gap-0.5" aria-label="Loading pull requests">
        {Array.from({ length: limit }).map((_, index) => (
          <li key={index} className="px-2 py-1.5">
            <div className="h-3 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse"></div>
          </li>
        ))}
      </ul>
    );
  }

  if (!prs || prs.length === 0) {
    return (
      <p className="mt-1 px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 select-none">
        No pull requests
      </p>
    );
  }

  return (
    <ul className="mt-1 flex flex-col gap-0.5">
      {prs.map((pr) => {
        const [owner = "", repo = ""] = pr.repoFullName?.split("/", 2) ?? [
          "",
          "",
        ];
        const branchLabel = pr.headRef;
        return (
          <li key={`${pr.repoFullName}#${pr.number}`}>
            <Link
              to="/$teamSlugOrId/prs-only/$owner/$repo/$number"
              params={{
                teamSlugOrId,
                owner,
                repo,
                number: String(pr.number),
              }}
              className={clsx(
                "group block rounded-md px-2 py-0.5 hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70 transition-colors cursor-default"
              )}
            >
              <div className="flex items-center gap-2">
                <div className="text-[12px] font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {pr.title}
                </div>
              </div>
              <div className="mt-0.5 text-[10px] text-neutral-600 dark:text-neutral-400 truncate">
                {[branchLabel, `${pr.repoFullName}#${pr.number}`]
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default SidebarPullRequestList;
