import { client as wwwOpenAPIClient } from "@cmux/www-openapi-client/client.gen";
import { StackClientApp } from "@stackframe/react";
import { useNavigate as useTanstackNavigate } from "@tanstack/react-router";
import { env } from "../client-env";
import { signalConvexAuthReady } from "../contexts/convex/convex-auth-ready";
import { convexQueryClient } from "../contexts/convex/convex-query-client";
import { cachedGetUser } from "./cachedGetUser";
import { WWW_ORIGIN } from "./wwwOrigin";

export const stackClientApp = new StackClientApp({
  projectId: env.NEXT_PUBLIC_STACK_PROJECT_ID,
  publishableClientKey: env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  tokenStore: "cookie",
  redirectMethod: {
    useNavigate() {
      const navigate = useTanstackNavigate();
      return (to: string) => {
        navigate({ to });
      };
    },
  },
});

type ConvexAuthFetcher = Parameters<
  typeof convexQueryClient.convexClient.setAuth
>[0];

type StackClientAppWithConvex = StackClientApp & {
  getConvexClientAuth?: (options: {
    tokenStore: "cookie" | "nextjs-cookie" | "memory" | null;
  }) => ConvexAuthFetcher;
};

function buildLegacyConvexClientAuthFetcher(
  app: StackClientApp
): ConvexAuthFetcher {
  let cachedAccessToken: string | null = null;
  return async ({ forceRefreshToken }) => {
    const user = await cachedGetUser(app);
    if (!user) {
      console.warn("[StackAuth] No user; convex auth not ready");
      signalConvexAuthReady(false);
      cachedAccessToken = null;
      return null;
    }

    if (!forceRefreshToken && cachedAccessToken) {
      return cachedAccessToken;
    }

    const authJson = await user.getAuthJson();
    const accessToken = authJson?.accessToken ?? null;
    if (!accessToken) {
      console.warn("[StackAuth] No access token; convex auth not ready");
      signalConvexAuthReady(false);
    }
    cachedAccessToken = accessToken;
    return accessToken;
  };
}

const getConvexClientAuth =
  (stackClientApp as StackClientAppWithConvex).getConvexClientAuth ??
  ((options: { tokenStore: "cookie" | "nextjs-cookie" | "memory" | null }) => {
    if (options.tokenStore && options.tokenStore !== "cookie") {
      console.warn(
        `[StackAuth] Unsupported tokenStore "${options.tokenStore}" for legacy Convex integration; defaulting to cookies.`
      );
    }
    return buildLegacyConvexClientAuthFetcher(stackClientApp);
  });

const convexAuthFetcher = getConvexClientAuth({ tokenStore: "cookie" });

convexQueryClient.convexClient.setAuth(convexAuthFetcher, (isAuthenticated) => {
  signalConvexAuthReady(isAuthenticated);
});

const fetchWithAuth = (async (request: Request) => {
  const user = await cachedGetUser(stackClientApp);
  if (!user) {
    throw new Error("User not found");
  }
  const authHeaders = await user.getAuthHeaders();
  const mergedHeaders = new Headers();
  for (const [key, value] of Object.entries(authHeaders)) {
    mergedHeaders.set(key, value);
  }
  for (const [key, value] of request instanceof Request
    ? request.headers.entries()
    : []) {
    mergedHeaders.set(key, value);
  }
  const response = await fetch(request, {
    headers: mergedHeaders,
  });
  if (!response.ok) {
    try {
      const clone = response.clone();
      const bodyText = await clone.text();
      console.error("[APIError]", {
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        body: bodyText.slice(0, 2000),
      });
    } catch (e) {
      console.error("[APIError] Failed to read error body", e);
    }
  }
  return response;
}) as typeof fetch; // TODO: remove when bun types dont conflict with node types

wwwOpenAPIClient.setConfig({
  baseUrl: WWW_ORIGIN,
  fetch: fetchWithAuth,
});
