
export type PrBasic = {
  number: number;
  html_url: string;
  state: string; // "open" | "closed"
  draft?: boolean;
};

export type PrDetail = {
  number: number;
  html_url: string;
  state: string;
  draft?: boolean;
  merged_at: string | null;
  node_id: string;
};

export function parseRepoFromUrl(url: string): { owner?: string; repo?: string; number?: number } {
  const m = url.match(/github\.com\/(.*?)\/(.*?)\/pull\/(\d+)/i);
  if (!m) return {};
  return { owner: m[1], repo: m[2], number: parseInt(m[3] || "", 10) || undefined };
}

type HttpInit = { method?: string; headers?: Record<string, string>; body?: string };

async function ghApi<T>(token: string, path: string, init?: HttpInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub API ${res.status}: ${txt}`);
  }
  return (await res.json()) as T;
}

export async function fetchPrByHead(
  token: string,
  owner: string,
  repo: string,
  headOwner: string,
  branchName: string
): Promise<PrBasic | null> {
  const qs = new URLSearchParams({ state: "all", head: `${headOwner}:${branchName}` }).toString();
  const list = await ghApi<PrBasic[]>(token, `/repos/${owner}/${repo}/pulls?${qs}`);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

export async function fetchPrDetail(
  token: string,
  owner: string,
  repo: string,
  number: number
): Promise<PrDetail> {
  return await ghApi<PrDetail>(token, `/repos/${owner}/${repo}/pulls/${number}`);
}

export async function createReadyPr(
  token: string,
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body: string
): Promise<PrBasic> {
  return await ghApi<PrBasic>(token, `/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, head, base, body, draft: false }),
  });
}

export async function markPrReady(
  token: string,
  owner: string,
  repo: string,
  number: number
): Promise<void> {
  // Try REST first
  const path = `/repos/${owner}/${repo}/pulls/${number}/ready_for_review`;
  try {
    await ghApi<void>(token, path, { method: "PUT" });
    return;
  } catch {}
  try {
    await ghApi<void>(token, path, { method: "POST" });
    return;
  } catch {}

  // GraphQL fallback
  const pr = await fetchPrDetail(token, owner, repo, number);
  const gqlRes = await fetch(`https://api.github.com/graphql`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query:
        "mutation MarkReady($id:ID!){ markPullRequestReadyForReview(input:{pullRequestId:$id}){ pullRequest { id isDraft } } }",
      variables: { id: pr.node_id },
    }),
  });
  const json = (await gqlRes.json()) as { data?: unknown; errors?: unknown };
  if (!gqlRes.ok || json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
}

export async function reopenPr(
  token: string,
  owner: string,
  repo: string,
  number: number
): Promise<void> {
  await ghApi<void>(token, `/repos/${owner}/${repo}/pulls/${number}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "open" }),
  });
}
