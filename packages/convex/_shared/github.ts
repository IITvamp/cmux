const MILLIS_THRESHOLD = 1_000_000_000_000;

export function normalizeTimestamp(
  value: number | string | null | undefined
): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    const normalized = value > MILLIS_THRESHOLD ? value : value * 1000;
    return Math.round(normalized);
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const normalized = numeric > MILLIS_THRESHOLD ? numeric : numeric * 1000;
    return Math.round(normalized);
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  return undefined;
}

export type GitHubRepository = {
  id?: number;
  full_name?: string;
  name?: string;
  owner?: {
    login?: string | null;
    type?: string | null;
  } | null;
  clone_url?: string | null;
  default_branch?: string | null;
  visibility?: string | null;
  private?: boolean | null;
  pushed_at?: string | number | null;
};

export type TransformedRepo = {
  providerRepoId: number;
  fullName: string;
  org: string;
  name: string;
  gitRemote: string;
  ownerLogin: string;
  ownerType?: "User" | "Organization";
  visibility?: "public" | "private";
  defaultBranch?: string;
  lastPushedAt?: number;
};

export function transformGitHubRepo(
  repo: GitHubRepository
): TransformedRepo | null {
  const providerRepoId = typeof repo.id === "number" ? repo.id : undefined;
  const fullName =
    typeof repo.full_name === "string" && repo.full_name
      ? repo.full_name
      : undefined;
  if (!providerRepoId || !fullName) {
    return null;
  }
  const name =
    typeof repo.name === "string" && repo.name
      ? repo.name
      : fullName.split("/")[1] ?? fullName;
  const ownerLogin =
    typeof repo.owner?.login === "string" && repo.owner.login
      ? repo.owner.login
      : fullName.split("/")[0] ?? "";
  if (!ownerLogin) {
    return null;
  }
  const ownerTypeRaw = repo.owner?.type ?? undefined;
  const ownerType =
    ownerTypeRaw === "Organization"
      ? "Organization"
      : ownerTypeRaw === "User"
      ? "User"
      : undefined;
  const visibility =
    repo.visibility === "public"
      ? "public"
      : repo.visibility === "private" || repo.private
      ? "private"
      : undefined;
  const defaultBranch =
    typeof repo.default_branch === "string" && repo.default_branch
      ? repo.default_branch
      : undefined;
  const gitRemote =
    typeof repo.clone_url === "string" && repo.clone_url
      ? repo.clone_url
      : `https://github.com/${fullName}.git`;

  const lastPushedAt = normalizeTimestamp(repo.pushed_at);

  return {
    providerRepoId,
    fullName,
    org: ownerLogin,
    name,
    gitRemote,
    ownerLogin,
    ...(ownerType !== undefined && { ownerType }),
    ...(visibility !== undefined && { visibility }),
    ...(defaultBranch !== undefined && { defaultBranch }),
    ...(lastPushedAt !== undefined && { lastPushedAt }),
  };
}
