import type { Id } from "@cmux/convex/dataModel";
import type { PrewarmedSandbox } from "@cmux/shared/socket-schemas";

const STORAGE_KEY = "cmux.prewarmedSandboxes.v1";
const PREWARM_TTL_MS = 5 * 60 * 1000;
const MAX_STORED_PREWARMS = 24;

const inflightKeys = new Set<string>();

export interface SandboxPrewarmContext {
  teamSlugOrId: string;
  projectFullName?: string | null;
  repoUrl?: string | null;
  branch?: string | null;
  environmentId?: Id<"environments"> | null;
  isCloudMode?: boolean;
}

type StoredState = Record<string, PrewarmedSandbox>;

const safeNow = () => Date.now();

const hasSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch (error) {
    console.error("[SandboxPrewarm] sessionStorage unavailable", error);
    return null;
  }
};

const loadState = (): StoredState => {
  const storage = hasSessionStorage();
  if (!storage) {
    return {};
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as StoredState;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error("[SandboxPrewarm] Failed to parse stored state", error);
  }

  return {};
};

const writeState = (state: StoredState): void => {
  const storage = hasSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("[SandboxPrewarm] Failed to persist state", error);
  }
};

const contextKey = (context: SandboxPrewarmContext): string => {
  const parts = [
    context.teamSlugOrId,
    context.environmentId ?? "_",
    context.projectFullName ?? "_",
    context.branch ?? "_",
    context.isCloudMode ? "cloud" : "local",
  ];
  return parts.join("|");
};

const prewarmKey = (
  context: SandboxPrewarmContext,
  agentName: string,
  occurrence: number,
): string => {
  return `${contextKey(context)}|${agentName}|${occurrence}`;
};

const contextsMatch = (
  stored: PrewarmedSandbox | undefined,
  context: SandboxPrewarmContext,
): boolean => {
  if (!stored) {
    return false;
  }

  const storedContext = stored.context || {};
  if (storedContext.teamSlugOrId && storedContext.teamSlugOrId !== context.teamSlugOrId) {
    return false;
  }

  if (storedContext.environmentId || context.environmentId) {
    if (storedContext.environmentId !== context.environmentId) {
      return false;
    }
  }

  if (storedContext.repoUrl || context.repoUrl) {
    if (storedContext.repoUrl !== context.repoUrl) {
      return false;
    }
  }

  if (storedContext.branch || context.branch) {
    if (storedContext.branch !== context.branch) {
      return false;
    }
  }

  if (storedContext.projectFullName || context.projectFullName) {
    if (storedContext.projectFullName !== context.projectFullName) {
      return false;
    }
  }

  if (storedContext.isCloudMode !== undefined && context.isCloudMode !== undefined) {
    if (storedContext.isCloudMode !== context.isCloudMode) {
      return false;
    }
  }

  return true;
};

const isFresh = (
  stored: PrewarmedSandbox | undefined,
  now: number,
  context: SandboxPrewarmContext,
): stored is PrewarmedSandbox => {
  if (!stored || !stored.createdAt) {
    return false;
  }

  if (now - stored.createdAt > PREWARM_TTL_MS) {
    return false;
  }

  return contextsMatch(stored, context);
};

const pruneState = (state: StoredState, now: number): boolean => {
  let changed = false;
  for (const [key, entry] of Object.entries(state)) {
    const createdAt = entry?.createdAt;
    if (!createdAt || now - createdAt > PREWARM_TTL_MS) {
      delete state[key];
      changed = true;
    }
  }
  if (Object.keys(state).length > MAX_STORED_PREWARMS) {
    const sorted = Object.entries(state).sort(([, a], [, b]) => {
      const aTime = a?.createdAt ?? 0;
      const bTime = b?.createdAt ?? 0;
      return aTime - bTime;
    });
    const excess = sorted.length - MAX_STORED_PREWARMS;
    for (let i = 0; i < excess; i++) {
      const [key] = sorted[i] ?? [];
      if (key) {
        delete state[key];
        changed = true;
      }
    }
  }
  return changed;
};

const startSandboxPrewarm = async (
  context: SandboxPrewarmContext,
  agentName: string,
): Promise<PrewarmedSandbox | null> => {
  if (!context.teamSlugOrId) {
    return null;
  }

  if (!context.isCloudMode) {
    return null;
  }

  if (!context.environmentId && !context.repoUrl) {
    return null;
  }

  const body: Record<string, unknown> = {
    teamSlugOrId: context.teamSlugOrId,
    ttlSeconds: 20 * 60,
    depth: 1,
    metadata: {
      prewarm: "true",
      source: "dashboard",
      agentName,
    },
  };

  if (context.environmentId) {
    body.environmentId = context.environmentId;
  }

  if (context.repoUrl) {
    body.repoUrl = context.repoUrl;
    if (context.branch) {
      body.branch = context.branch;
    }
  }

  try {
    const response = await fetch("/api/sandboxes/start", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as {
      instanceId: string;
      vscodeUrl: string;
      workerUrl: string;
      provider?: "morph" | "docker" | "daytona";
    };

    const createdAt = safeNow();

    return {
      agentName,
      instanceId: data.instanceId,
      vscodeUrl: data.vscodeUrl,
      workerUrl: data.workerUrl,
      provider: data.provider ?? "morph",
      createdAt,
      context: {
        teamSlugOrId: context.teamSlugOrId,
        projectFullName: context.projectFullName ?? null,
        branch: context.branch ?? null,
        environmentId: context.environmentId ?? null,
        repoUrl: context.repoUrl ?? null,
        isCloudMode: context.isCloudMode ?? true,
      },
    } satisfies PrewarmedSandbox;
  } catch (error) {
    console.error(
      `[SandboxPrewarm] Failed to start sandbox for ${agentName}`,
      error,
    );
    return null;
  }
};

export const ensurePrewarmedSandboxes = async (
  context: SandboxPrewarmContext,
  agents: string[],
): Promise<void> => {
  if (agents.length === 0) {
    return;
  }

  if (!context.isCloudMode) {
    return;
  }

  const state = loadState();
  const now = safeNow();
  const stateChanged = pruneState(state, now);

  const tasks: Array<Promise<void>> = [];
  const counts = new Map<string, number>();

  for (const agentName of agents) {
    const occurrence = (counts.get(agentName) ?? 0) + 1;
    counts.set(agentName, occurrence);

    const key = prewarmKey(context, agentName, occurrence);
    const existing = state[key];

    if (isFresh(existing, now, context)) {
      continue;
    }

    if (inflightKeys.has(key)) {
      continue;
    }

    inflightKeys.add(key);
    tasks.push(
      startSandboxPrewarm(context, agentName)
        .then((sandbox) => {
          if (!sandbox) {
            return;
          }
          state[key] = sandbox;
        })
        .finally(() => {
          inflightKeys.delete(key);
        }),
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
    writeState(state);
  } else if (stateChanged) {
    writeState(state);
  }
};

export const consumePrewarmedSandboxes = (
  context: SandboxPrewarmContext,
  agents: string[],
): PrewarmedSandbox[] => {
  if (agents.length === 0) {
    return [];
  }

  const state = loadState();
  const now = safeNow();
  let mutated = pruneState(state, now);
  const consumed: PrewarmedSandbox[] = [];
  const counts = new Map<string, number>();

  for (const agentName of agents) {
    const occurrence = (counts.get(agentName) ?? 0) + 1;
    counts.set(agentName, occurrence);

    const key = prewarmKey(context, agentName, occurrence);
    const entry = state[key];
    if (!isFresh(entry, now, context)) {
      delete state[key];
      mutated = true;
      continue;
    }

    consumed.push(entry);
    delete state[key];
    mutated = true;
  }

  if (mutated) {
    writeState(state);
  }

  return consumed;
};
