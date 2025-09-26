import { app, type Session } from "electron";
import { promises as fs } from "node:fs";
import { join } from "node:path";

type Logger = {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

type PersistedAuthState = {
  refreshToken: string | null;
  refreshExpiration: number | null;
  accessToken: string | null;
  accessExpiration: number | null;
  updatedAt: number;
};

const AUTH_STATE_FILENAME = "stack-auth-state.json";

function resolveAuthStatePath(): string {
  return join(app.getPath("userData"), AUTH_STATE_FILENAME);
}

function normalizeState(raw: unknown): PersistedAuthState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const refreshToken = typeof value.refreshToken === "string" ? value.refreshToken : null;
  const refreshExpiration =
    typeof value.refreshExpiration === "number" && Number.isFinite(value.refreshExpiration)
      ? value.refreshExpiration
      : null;
  const accessToken = typeof value.accessToken === "string" ? value.accessToken : null;
  const accessExpiration =
    typeof value.accessExpiration === "number" && Number.isFinite(value.accessExpiration)
      ? value.accessExpiration
      : null;
  const updatedAt =
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : Math.floor(Date.now() / 1000);
  if (!refreshToken && !accessToken) {
    return {
      refreshToken: null,
      refreshExpiration: null,
      accessToken: null,
      accessExpiration: null,
      updatedAt,
    };
  }
  return {
    refreshToken,
    refreshExpiration,
    accessToken,
    accessExpiration,
    updatedAt,
  };
}

async function readPersistedAuthState(logger: Logger): Promise<PersistedAuthState | null> {
  const path = resolveAuthStatePath();
  try {
    const raw = await fs.readFile(path, { encoding: "utf8" });
    const parsed = normalizeState(JSON.parse(raw));
    if (!parsed) return null;
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    logger.warn("Failed to read persisted auth state", error);
    return null;
  }
}

async function deletePersistedAuthState(): Promise<void> {
  const path = resolveAuthStatePath();
  try {
    await fs.rm(path, { force: true });
  } catch {
    // ignore
  }
}

async function writePersistedAuthState(
  state: PersistedAuthState | null,
  logger: Logger
): Promise<void> {
  if (!state || (!state.refreshToken && !state.accessToken)) {
    await deletePersistedAuthState();
    return;
  }
  const path = resolveAuthStatePath();
  const payload = JSON.stringify(state, null, 2);
  try {
    await fs.writeFile(path, payload, { encoding: "utf8" });
  } catch (error) {
    logger.warn("Failed to write persisted auth state", error);
  }
}

function cookieNames(projectId: string): { refresh: string; access: string } {
  return {
    refresh: `stack-refresh-${projectId}`,
    access: "stack-access",
  };
}

function isExpired(expiration: number | null): boolean {
  if (!expiration) return false;
  const now = Math.floor(Date.now() / 1000);
  return expiration <= now;
}

async function extractAuthCookies(
  ses: Session,
  baseUrl: string,
  projectId: string
): Promise<{
  refresh: Electron.Cookie | undefined;
  access: Electron.Cookie | undefined;
}> {
  const names = cookieNames(projectId);
  const [refresh] = await ses.cookies.get({ url: baseUrl, name: names.refresh });
  const [access] = await ses.cookies.get({ url: baseUrl, name: names.access });
  return { refresh, access };
}

export async function restoreAuthCookiesFromDisk(options: {
  session: Session;
  baseUrl: string;
  projectId: string;
  logger: Logger;
}): Promise<void> {
  const { session, baseUrl, projectId, logger } = options;
  const persisted = await readPersistedAuthState(logger);
  if (!persisted) {
    await deletePersistedAuthState();
    return;
  }

  const names = cookieNames(projectId);
  const tasks: Promise<void>[] = [];

  if (persisted.refreshToken && !isExpired(persisted.refreshExpiration)) {
    tasks.push(
      session.cookies.set({
        url: baseUrl,
        name: names.refresh,
        value: persisted.refreshToken,
        expirationDate: persisted.refreshExpiration ?? undefined,
        sameSite: "no_restriction",
        secure: true,
      })
    );
  }
  if (persisted.accessToken && !isExpired(persisted.accessExpiration)) {
    tasks.push(
      session.cookies.set({
        url: baseUrl,
        name: names.access,
        value: persisted.accessToken,
        expirationDate: persisted.accessExpiration ?? undefined,
        sameSite: "no_restriction",
        secure: true,
      })
    );
  }

  if (tasks.length === 0) {
    await writePersistedAuthState(null, logger);
    return;
  }

  try {
    await Promise.all(tasks);
    await session.cookies.flushStore();
  } catch (error) {
    logger.warn("Failed to restore auth cookies from disk", error);
  }
}

export async function syncAuthCookiesToDisk(options: {
  session: Session;
  baseUrl: string;
  projectId: string;
  logger: Logger;
}): Promise<void> {
  const { session, baseUrl, projectId, logger } = options;
  try {
    const { refresh, access } = await extractAuthCookies(session, baseUrl, projectId);
    const state: PersistedAuthState = {
      refreshToken: refresh?.value ?? null,
      refreshExpiration: refresh?.expirationDate ?? null,
      accessToken: access?.value ?? null,
      accessExpiration: access?.expirationDate ?? null,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    await writePersistedAuthState(state, logger);
  } catch (error) {
    logger.warn("Failed to sync auth cookies to disk", error);
  }
}

export function startAuthCookiePersistence(options: {
  session: Session;
  baseUrl: string;
  projectId: string;
  logger: Logger;
}): void {
  const { session, baseUrl, projectId, logger } = options;
  const names = cookieNames(projectId);
  const relevant = new Set([names.refresh, names.access]);

  const scheduleSync = (() => {
    let running = false;
    let queued = false;

    const run = async () => {
      if (running) {
        queued = true;
        return;
      }
      running = true;
      queued = false;
      try {
        await syncAuthCookiesToDisk({ session, baseUrl, projectId, logger });
      } finally {
        running = false;
        if (queued) {
          void run();
        }
      }
    };

    return () => {
      void run();
    };
  })();

  session.cookies.on("changed", (_event, cookie) => {
    if (!relevant.has(cookie.name)) return;
    scheduleSync();
  });

  void syncAuthCookiesToDisk({ session, baseUrl, projectId, logger });
}
