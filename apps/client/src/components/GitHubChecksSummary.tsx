import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { useQuery as useConvexQuery } from "convex/react";
import { CheckCircle2, Clock, Dot, XCircle } from "lucide-react";

export function GitHubChecksSummary({
  teamSlugOrId,
  repoFullName,
  sha,
  className,
}: {
  teamSlugOrId: string;
  repoFullName: string;
  sha: string;
  className?: string;
}) {
  const checks = useConvexQuery(api.github_checks.listByRepoAndSha, {
    teamSlugOrId,
    repoFullName,
    sha,
  });

  // Determine overall state
  const items = (checks || []) as Doc<"commitChecks">[];
  const counts = items.reduce(
    (acc, c) => {
      const isPending = c.status === "queued" || c.status === "in_progress" || c.status === "pending";
      if (isPending) acc.pending++;
      else if (c.conclusion === "success") acc.success++;
      else acc.failed++;
      return acc;
    },
    { success: 0, failed: 0, pending: 0 }
  );

  const badge = () => {
    if (counts.pending > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 text-[11px] font-medium">
          <Clock className="w-3.5 h-3.5" /> {counts.pending} pending
        </span>
      );
    }
    if (counts.failed > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 text-[11px] font-medium">
          <XCircle className="w-3.5 h-3.5" /> {counts.failed} failing
        </span>
      );
    }
    if ((items.length > 0 && counts.success === items.length) || (items.length > 0 && counts.success > 0 && counts.failed === 0)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200 text-[11px] font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> {counts.success} passing
        </span>
      );
    }
    return null;
  };

  return (
    <div className={className || "flex items-center gap-2"}>
      {badge()}
      {items.slice(0, 4).map((c) => {
        const isPending = c.status === "queued" || c.status === "in_progress" || c.status === "pending";
        const color = isPending
          ? "text-amber-500"
          : c.conclusion === "success"
          ? "text-green-500"
          : "text-red-500";
        return (
          <a
            key={`${c.name}-${c.sha}`}
            href={c.detailsUrl ?? "#"}
            target={c.detailsUrl ? "_blank" : undefined}
            rel={c.detailsUrl ? "noreferrer" : undefined}
            className="inline-flex items-center gap-1 text-[11px] text-neutral-700 dark:text-neutral-300 hover:underline"
            title={`${c.name}: ${c.status || c.conclusion || "unknown"}`}
          >
            <Dot className={`w-5 h-5 ${color}`} />
            <span className="truncate max-w-[160px]">{c.name}</span>
          </a>
        );
      })}
      {items.length > 4 ? (
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">+{items.length - 4} more</span>
      ) : null}
    </div>
  );
}

