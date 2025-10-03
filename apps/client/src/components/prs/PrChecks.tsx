import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Circle, Clock, ExternalLink } from "lucide-react";
import { useMemo } from "react";

interface PrChecksProps {
  owner: string;
  repo: string;
  ref: string;
}

type CheckConclusion = "success" | "failure" | "pending" | "neutral";

type CheckRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type CommitStatus = {
  id: number;
  state: string;
  description: string | null;
  context: string;
  target_url: string | null;
  created_at: string;
  updated_at: string;
};

type PrChecksResponse = {
  checkRuns: CheckRun[];
  commitStatuses: CommitStatus[];
  totalCount: number;
  conclusion: CheckConclusion;
};

export function PrChecks({ owner, repo, ref }: PrChecksProps) {
  const { data, isLoading, error } = useQuery<PrChecksResponse>({
    queryKey: ["pr-checks", owner, repo, ref],
    queryFn: async () => {
      const params = new URLSearchParams({ owner, repo, ref });
      const response = await fetch(
        `/api/integrations/github/prs/checks?${params.toString()}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch PR checks");
      }
      return response.json();
    },
    refetchInterval: 30000, // Poll every 30 seconds
    retry: 2,
  });

  const summary = useMemo(() => {
    if (!data) return null;

    const total = data.totalCount;
    const checkRuns = data.checkRuns || [];
    const statuses = data.commitStatuses || [];

    const successful =
      checkRuns.filter((run) => run.conclusion === "success").length +
      statuses.filter((status) => status.state === "success").length;

    const failed =
      checkRuns.filter(
        (run) => run.conclusion === "failure" || run.conclusion === "cancelled"
      ).length +
      statuses.filter(
        (status) => status.state === "error" || status.state === "failure"
      ).length;

    const pending =
      checkRuns.filter((run) => run.status !== "completed").length +
      statuses.filter((status) => status.state === "pending").length;

    return { total, successful, failed, pending };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs text-neutral-600 dark:text-neutral-400">
        <Circle className="w-3.5 h-3.5 animate-spin" />
        <span>Loading checks...</span>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  if (data.totalCount === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs text-neutral-600 dark:text-neutral-400">
        <Circle className="w-3.5 h-3.5" />
        <span>No checks</span>
      </div>
    );
  }

  const conclusion = data.conclusion;
  const Icon = getIconForConclusion(conclusion);
  const colorClasses = getColorClassesForConclusion(conclusion);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium",
          colorClasses.bg,
          colorClasses.text
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>
          {conclusion === "success" && `${summary?.successful} checks passed`}
          {conclusion === "failure" && `${summary?.failed} checks failed`}
          {conclusion === "pending" && `${summary?.pending} checks in progress`}
          {conclusion === "neutral" && "No checks configured"}
        </span>
      </div>

      {(data.checkRuns.length > 0 || data.commitStatuses.length > 0) && (
        <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
          {data.checkRuns.map((run) => (
            <CheckItem
              key={`check-${run.id}`}
              name={run.name}
              status={run.status}
              conclusion={run.conclusion || undefined}
              url={run.html_url || undefined}
            />
          ))}
          {data.commitStatuses.map((status) => (
            <CheckItem
              key={`status-${status.id}`}
              name={status.context}
              status={status.state === "pending" ? "in_progress" : "completed"}
              conclusion={mapStatusStateToConclusion(status.state)}
              url={status.target_url || undefined}
              description={status.description || undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CheckItemProps {
  name: string;
  status: string;
  conclusion?: string;
  url?: string;
  description?: string;
}

function CheckItem({ name, status, conclusion, url, description }: CheckItemProps) {
  const isCompleted = status === "completed";
  const isPending = !isCompleted;

  let icon = <Circle className="w-3 h-3" />;
  let colorClass = "text-neutral-500 dark:text-neutral-400";

  if (isPending) {
    icon = <Clock className="w-3 h-3 animate-pulse" />;
    colorClass = "text-yellow-600 dark:text-yellow-400";
  } else if (conclusion === "success") {
    icon = <CheckCircle2 className="w-3 h-3" />;
    colorClass = "text-green-600 dark:text-green-400";
  } else if (
    conclusion === "failure" ||
    conclusion === "error" ||
    conclusion === "cancelled"
  ) {
    icon = <XCircle className="w-3 h-3" />;
    colorClass = "text-red-600 dark:text-red-400";
  }

  const content = (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
      <div className={colorClass}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-neutral-900 dark:text-white truncate">
          {name}
        </div>
        {description && (
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
            {description}
          </div>
        )}
      </div>
      {url && <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />}
    </div>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block"
      >
        {content}
      </a>
    );
  }

  return <div>{content}</div>;
}

function getIconForConclusion(conclusion: CheckConclusion) {
  switch (conclusion) {
    case "success":
      return CheckCircle2;
    case "failure":
      return XCircle;
    case "pending":
      return Clock;
    case "neutral":
    default:
      return Circle;
  }
}

function getColorClassesForConclusion(conclusion: CheckConclusion) {
  switch (conclusion) {
    case "success":
      return {
        bg: "bg-green-100 dark:bg-green-900/20",
        text: "text-green-800 dark:text-green-300",
      };
    case "failure":
      return {
        bg: "bg-red-100 dark:bg-red-900/20",
        text: "text-red-800 dark:text-red-300",
      };
    case "pending":
      return {
        bg: "bg-yellow-100 dark:bg-yellow-900/20",
        text: "text-yellow-800 dark:text-yellow-300",
      };
    case "neutral":
    default:
      return {
        bg: "bg-neutral-100 dark:bg-neutral-800",
        text: "text-neutral-600 dark:text-neutral-400",
      };
  }
}

function mapStatusStateToConclusion(state: string): string {
  switch (state) {
    case "success":
      return "success";
    case "error":
    case "failure":
      return "failure";
    case "pending":
      return "pending";
    default:
      return "neutral";
  }
}
