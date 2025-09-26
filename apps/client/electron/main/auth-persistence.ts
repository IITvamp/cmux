import { app, type Cookies, type Session } from "electron";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

type CookiesSetSameSite = Parameters<Cookies["set"]>[0]["sameSite"];

const AUTH_STATE_FILENAME = "stack-auth-state.json";

const COOKIE_SAME_SITE_VALUES = new Set<CookiesSetSameSite | undefined>([
  "unspecified",
  "no_restriction",
  "lax",
  "strict",
]);

type PersistedAuthState = {
  refreshToken: string;
  refreshExpiration?: number;
  accessToken: string;
  accessExpiration?: number;
  domain: string;
  path: string;
  secure: boolean;
  hostOnly: boolean;
  httpOnly: boolean;
  sameSite?: CookiesSetSameSite;
};

type Logger = {
  log: (message: string, details?: Record<string, unknown>) => void;
  warn: (message: string, details?: unknown) => void;
};

type CookieNames = {
  refresh: string;
  access: string;
};

type RestoreParams = {
  session: Session;
  cookieNames: CookieNames;
  hostFallback: string;
  logger: Logger;
};

type PersistParams = RestoreParams;

type WatchParams = RestoreParams;

function stateFilePath(): string {
  return join(app.getPath("userData"), AUTH_STATE_FILENAME);
}

async function readPersistedState(logger: Logger): Promise<PersistedAuthState | null> {
  try {
    const raw = await fs.readFile(stateFilePath(), { encoding: "utf8" });
    return parsePersistedState(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    logger.warn("Failed to read persisted Stack auth state", error);
    return null;
  }
}

async function writePersistedState(state: PersistedAuthState, logger: Logger): Promise<void> {
  try {
    const file = stateFilePath();
    await fs.mkdir(dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ ...state, savedAt: new Date().toISOString() }), {
      encoding: "utf8",
    });
  } catch (error) {
    logger.warn("Failed to persist Stack auth state", error);
  }
}

async function removePersistedState(logger: Logger): Promise<void> {
  try {
    await fs.unlink(stateFilePath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return;
    logger.warn("Failed to remove persisted Stack auth state", error);
  }
}

function parsePersistedState(raw: string): PersistedAuthState | null {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const {
      refreshToken,
      refreshExpiration,
      accessToken,
      accessExpiration,
      domain,
      path,
      secure,
      hostOnly,
      httpOnly,
      sameSite,
    } = data as Record<string, unknown>;
    if (
      typeof refreshToken !== "string" ||
      typeof accessToken !== "string" ||
      typeof domain !== "string" ||
      typeof path !== "string" ||
      typeof secure !== "boolean" ||
      typeof hostOnly !== "boolean" ||
      typeof httpOnly !== "boolean"
    ) {
      return null;
    }
    if (
      sameSite !== undefined &&
      (typeof sameSite !== "string" || !COOKIE_SAME_SITE_VALUES.has(sameSite as CookiesSetSameSite))
    ) {
      return null;
    }
    return {
      refreshToken,
      refreshExpiration: typeof refreshExpiration === "number" ? refreshExpiration : undefined,
      accessToken,
      accessExpiration: typeof accessExpiration === "number" ? accessExpiration : undefined,
      domain,
      path,
      secure,
      hostOnly,
      httpOnly,
      sameSite: sameSite as CookiesSetSameSite | undefined,
    };
  } catch {
    return null;
  }
}

function cookieHost(domain: string, hostOnly: boolean, fallbackHost: string): string {
  if (!domain && fallbackHost) return fallbackHost;
  if (hostOnly) return domain || fallbackHost;
  if (domain.startsWith(".")) return domain.slice(1) || fallbackHost;
  return domain || fallbackHost;
}

function buildCookieUrl(state: PersistedAuthState, fallbackHost: string): string {
  const host = cookieHost(state.domain, state.hostOnly, fallbackHost);
  const path = state.path.startsWith("/") ? state.path : `/${state.path}`;
  const scheme = state.secure ? "https" : "http";
  return `${scheme}://${host}${path}`;
}

async function fetchRelevantCookies(
  session: Session,
  cookieNames: CookieNames
): Promise<{ refresh?: Electron.Cookie; access?: Electron.Cookie }> {
  const [refresh] = await session.cookies.get({ name: cookieNames.refresh });
  const [access] = await session.cookies.get({ name: cookieNames.access });
  return { refresh, access };
}

async function syncPersistedState(
  { session, cookieNames, hostFallback, logger }: PersistParams,
  cookies?: { refresh?: Electron.Cookie; access?: Electron.Cookie }
): Promise<void> {
  const resolved = cookies ?? (await fetchRelevantCookies(session, cookieNames));
  const { refresh, access } = resolved;
  if (!refresh || !access) {
    await removePersistedState(logger);
    return;
  }

  const state: PersistedAuthState = {
    refreshToken: refresh.value,
    refreshExpiration: refresh.expirationDate,
    accessToken: access.value,
    accessExpiration: access.expirationDate,
    domain: refresh.domain ?? access.domain ?? hostFallback,
    path: refresh.path ?? access.path ?? "/",
    secure: refresh.secure ?? access.secure ?? true,
    hostOnly: refresh.hostOnly ?? access.hostOnly ?? true,
    httpOnly: refresh.httpOnly ?? access.httpOnly ?? false,
    sameSite: refresh.sameSite ?? access.sameSite ?? "no_restriction",
  };

  await writePersistedState(state, logger);
}

export async function restorePersistedStackAuth(
  params: RestoreParams
): Promise<void> {
  const { session, cookieNames, hostFallback, logger } = params;

  const [existingRefresh] = await session.cookies.get({ name: cookieNames.refresh });
  const [existingAccess] = await session.cookies.get({ name: cookieNames.access });
  if (existingRefresh && existingAccess) {
    return;
  }

  const state = await readPersistedState(logger);
  if (!state) return;

  const url = buildCookieUrl(state, hostFallback);
  const options = {
    domain: state.domain,
    path: state.path,
    secure: state.secure,
    httpOnly: state.httpOnly,
    sameSite: state.sameSite,
  } satisfies Partial<Parameters<Cookies["set"]>[0]>;

  await Promise.all([
    session.cookies.set({
      url,
      name: cookieNames.refresh,
      value: state.refreshToken,
      expirationDate: state.refreshExpiration,
      ...options,
    }),
    session.cookies.set({
      url,
      name: cookieNames.access,
      value: state.accessToken,
      expirationDate: state.accessExpiration,
      ...options,
    }),
  ]);

  logger.log("Restored Stack auth cookies from persisted state");
}

export async function persistCurrentStackAuth(params: PersistParams): Promise<void> {
  try {
    await syncPersistedState(params);
  } catch (error) {
    params.logger.warn("Failed to persist current Stack auth cookies", error);
  }
}

export function watchStackAuthCookies(params: WatchParams): void {
  const { session, cookieNames, logger } = params;

  const handler = async (
    _event: Electron.Event,
    cookie: Electron.Cookie,
    _cause: "explicit" | "overwrite" | "expired" | "evicted" | "expired_overwrite",
    _removed: boolean
  ) => {
    if (cookie.name !== cookieNames.refresh && cookie.name !== cookieNames.access) {
      return;
    }
    try {
      await syncPersistedState(params);
    } catch (error) {
      logger.warn("Failed to sync persisted Stack auth cookies", error);
    }
  };

  session.cookies.on("changed", handler);
}
