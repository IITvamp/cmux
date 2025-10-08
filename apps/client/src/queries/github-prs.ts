import { queryOptions, type QueryFunctionContext } from "@tanstack/react-query";
import { postApiApiIntegrationsGithubPrsSyncChecks } from "@cmux/www-openapi-client";

const syncPullRequestChecksQueryKey = (
  teamSlugOrId: string,
  owner: string,
  repo: string,
  prNumber: number | null,
  headSha: string | null,
) =>
  [
    "github-pr-sync-checks",
    teamSlugOrId,
    owner,
    repo,
    prNumber,
    headSha,
  ] as const;

type SyncPullRequestChecksQueryKey = ReturnType<typeof syncPullRequestChecksQueryKey>;

async function syncPullRequestChecksQueryFn({
  queryKey,
  signal,
}: QueryFunctionContext<SyncPullRequestChecksQueryKey>) {
  const [, teamSlugOrId, owner, repo, prNumber, headSha] = queryKey;

  if (typeof prNumber !== "number") {
    return null;
  }

  const { data } = await postApiApiIntegrationsGithubPrsSyncChecks({
    body: {
      teamSlugOrId,
      owner,
      repo,
      prNumber,
      ...(headSha ? { ref: headSha } : {}),
    },
    signal,
    throwOnError: true,
  });

  return data;
}

export function syncPullRequestChecksQueryOptions({
  teamSlugOrId,
  owner,
  repo,
  prNumber,
  headSha,
}: {
  teamSlugOrId: string;
  owner: string;
  repo: string;
  prNumber: number | null;
  headSha: string | null;
}) {
  return queryOptions({
    queryKey: syncPullRequestChecksQueryKey(
      teamSlugOrId,
      owner,
      repo,
      prNumber,
      headSha,
    ),
    queryFn: syncPullRequestChecksQueryFn,
    enabled: typeof prNumber === "number",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: "always",
  });
}

