import { useEffect } from "react";
import { stackClientApp } from "./stack";
import { cachedGetUser } from "./cachedGetUser";

type StackTokens = Awaited<ReturnType<Window["cmux"]["stackAuth"]["get"]>>;

type TokenSnapshot = { refreshToken: string; accessToken: string } | null;

const SYNC_INTERVAL_MS = 60_000;

export function StackAuthBridge(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stackAuth = window.cmux?.stackAuth;
    if (!stackAuth) return;

    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let lastApplied: TokenSnapshot = null;
    let lastPersisted: TokenSnapshot = null;

    const applyTokens = async (tokens: StackTokens) => {
      if (disposed) return;
      const refreshToken = tokens?.refreshToken ?? null;
      const accessToken = tokens?.accessToken ?? null;

      if (
        lastApplied &&
        refreshToken === lastApplied.refreshToken &&
        accessToken === lastApplied.accessToken
      ) {
        return;
      }

      const stackAny = stackClientApp as unknown as {
        _signInToAccountWithTokens?: (tokens: {
          refreshToken: string;
          accessToken: string;
        }) => Promise<void>;
        _memoryTokenStore?: {
          set?: (value: { refreshToken: string | null; accessToken: string | null }) => void;
        };
      };

      try {
        if (refreshToken && accessToken) {
          if (typeof stackAny._signInToAccountWithTokens === "function") {
            await stackAny._signInToAccountWithTokens({
              refreshToken,
              accessToken,
            });
          } else if (stackAny._memoryTokenStore?.set) {
            stackAny._memoryTokenStore.set({ refreshToken, accessToken });
          }
          lastApplied = { refreshToken, accessToken };
        } else {
          stackAny._memoryTokenStore?.set?.({
            refreshToken: null,
            accessToken: null,
          });
          lastApplied = null;
        }
      } catch (error) {
        console.warn("[StackAuthBridge] Failed to apply Stack tokens", error);
      }
    };

    const handleTokensUpdated = (tokens: StackTokens) => {
      if (tokens && tokens.refreshToken && tokens.accessToken) {
        lastPersisted = {
          refreshToken: tokens.refreshToken,
          accessToken: tokens.accessToken,
        };
      } else {
        lastPersisted = null;
      }
      void applyTokens(tokens);
    };

    (async () => {
      try {
        const existing = await stackAuth.get();
        if (disposed) return;
        if (existing && existing.refreshToken && existing.accessToken) {
          lastPersisted = {
            refreshToken: existing.refreshToken,
            accessToken: existing.accessToken,
          };
        }
        await applyTokens(existing);
      } catch (error) {
        console.warn("[StackAuthBridge] Failed to load persisted Stack tokens", error);
      }
    })();

    unsubscribe = stackAuth.onTokensUpdated((tokens) => {
      void handleTokensUpdated(tokens);
    });

    const syncTokens = async () => {
      if (disposed) return;
      try {
        const user = await cachedGetUser(stackClientApp);
        if (!user) {
          if (lastPersisted) {
            lastPersisted = null;
            await stackAuth.clear();
          }
          return;
        }
        const sessionTokens = await user.currentSession.getTokens();
        const refreshToken = sessionTokens.refreshToken ?? null;
        const accessToken = sessionTokens.accessToken ?? null;
        if (!refreshToken || !accessToken) {
          if (lastPersisted) {
            lastPersisted = null;
            await stackAuth.clear();
          }
          return;
        }
        if (
          !lastPersisted ||
          lastPersisted.refreshToken !== refreshToken ||
          lastPersisted.accessToken !== accessToken
        ) {
          lastPersisted = { refreshToken, accessToken };
          await stackAuth.set(lastPersisted);
        }
      } catch (error) {
        console.warn("[StackAuthBridge] Failed to sync Stack tokens", error);
      }
    };

    void syncTokens();
    pollTimer = setInterval(syncTokens, SYNC_INTERVAL_MS);

    return () => {
      disposed = true;
      unsubscribe?.();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  return null;
}
