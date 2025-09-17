export type RecentProjectsMap = Record<string, number>;

const RECENT_PROJECTS_KEY = "recentProjects";
const MAX_TRACKED_RECENT_PROJECTS = 50;

function readStorageValue(): RecentProjectsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const entries = Object.entries(parsed as Record<string, unknown>);
    const result: RecentProjectsMap = {};
    for (const [key, value] of entries) {
      if (typeof key !== "string") continue;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      result[key] = value;
    }
    return result;
  } catch (error) {
    console.warn("Failed to parse recent projects from storage", error);
    return {};
  }
}

function writeStorageValue(map: RecentProjectsMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn("Failed to persist recent projects", error);
  }
}

export function loadRecentProjects(): RecentProjectsMap {
  return readStorageValue();
}

export function touchRecentProject(
  previous: RecentProjectsMap,
  fullName: string
): RecentProjectsMap {
  const nextMap = new Map<string, number>();
  if (previous) {
    for (const [key, value] of Object.entries(previous)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        nextMap.set(key, value);
      }
    }
  }

  const normalized = fullName.trim();
  if (normalized.length === 0) {
    return previous;
  }

  nextMap.set(normalized, Date.now());

  const sorted = Array.from(nextMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TRACKED_RECENT_PROJECTS);
  const result = Object.fromEntries(sorted) as RecentProjectsMap;
  writeStorageValue(result);
  return result;
}

export interface RepoLike {
  fullName: string;
  lastSyncedAt?: number;
  _creationTime?: number;
}

export function sortReposByRecency<T extends RepoLike>(
  repos: T[],
  recentProjects: RecentProjectsMap
): T[] {
  return [...repos].sort((a, b) => {
    const recentA = recentProjects[a.fullName] ?? 0;
    const recentB = recentProjects[b.fullName] ?? 0;
    if (recentA !== recentB) return recentB - recentA;

    const syncedA = a.lastSyncedAt ?? 0;
    const syncedB = b.lastSyncedAt ?? 0;
    if (syncedA !== syncedB) return syncedB - syncedA;

    const createdA = a._creationTime ?? 0;
    const createdB = b._creationTime ?? 0;
    if (createdA !== createdB) return createdB - createdA;

    return a.fullName.localeCompare(b.fullName);
  });
}
