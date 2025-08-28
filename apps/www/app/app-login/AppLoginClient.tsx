"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function buildDeepLink(params: {
  scheme?: string | null;
  path?: string | null;
  returnUrl?: string | null;
  refreshToken: string;
}): string {
  const { scheme, path, returnUrl, refreshToken } = params;
  if (returnUrl) {
    try {
      const url = new URL(returnUrl);
      url.searchParams.set("refresh_token", refreshToken);
      return url.toString();
    } catch {
      // fall through to scheme/path builder
    }
  }
  const finalScheme = (scheme ?? "cmux").replace("://", "");
  const rawPath = path ?? "auth/callback";
  const finalPath = rawPath.replace(/^\//, "");
  const deepLink = `${finalScheme}://${finalPath}`;
  const u = new URL(deepLink);
  u.searchParams.set("refresh_token", refreshToken);
  return u.toString();
}

export default function AppLoginClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; deepLink: string }
  >({ kind: "loading" });

  const scheme = useMemo(() => searchParams.get("scheme"), [searchParams]);
  const path = useMemo(() => searchParams.get("path"), [searchParams]);
  const returnUrl = useMemo(
    () => searchParams.get("return"),
    [searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch("/api/auth/refresh-token", {
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Request failed: ${res.status}`);
        }
        const data: { refreshToken: string } = await res.json();
        const deepLink = buildDeepLink({
          scheme,
          path,
          returnUrl,
          refreshToken: data.refreshToken,
        });
        if (!cancelled) {
          setStatus({ kind: "ready", deepLink });
          // Attempt automatic open
          window.location.href = deepLink;
        }
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Unknown error";
          setStatus({ kind: "error", message });
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [scheme, path, returnUrl]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Continue in App
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {status.kind === "loading"
            ? "Fetching credentials…"
            : status.kind === "error"
              ? "We couldn’t prepare the sign-in handoff."
              : "If it doesn’t open automatically, use the button below."}
        </p>

        <div className="mt-4">
          {status.kind === "loading" ? (
            <div className="h-9 w-28 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
          ) : status.kind === "error" ? (
            <>
              <pre className="text-xs whitespace-pre-wrap break-words text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded p-2">
                {status.message}
              </pre>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                Make sure you are signed in, then reload this page.
              </p>
            </>
          ) : (
            <a
              href={status.deepLink}
              className="inline-flex items-center justify-center h-9 rounded-md px-4 bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Open App
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

