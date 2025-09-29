import { client as wwwOpenAPIClient } from "@cmux/www-openapi-client/client.gen";
import { StackClientApp } from "@stackframe/react";
import { useNavigate as useTanstackNavigate } from "@tanstack/react-router";
import { env } from "../client-env";
import { signalConvexAuthReady } from "../contexts/convex/convex-auth-ready";
import { convexQueryClient } from "../contexts/convex/convex-query-client";
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

export const fetchConvexAuth = stackClientApp.getConvexClientAuth({
  tokenStore: "cookie",
});

convexQueryClient.convexClient.setAuth(
  async (args) => {
    try {
      const token = await fetchConvexAuth(args);
      if (!token) {
        console.warn("[StackAuth] Convex auth returned no token");
        signalConvexAuthReady(false);
      }
      return token;
    } catch (error) {
      console.error("[StackAuth] Failed to fetch Convex auth token", error);
      signalConvexAuthReady(false);
      throw error;
    }
  },
  (isAuthenticated) => {
    signalConvexAuthReady(isAuthenticated);
  }
);

void (async () => {
  try {
    const user = await stackClientApp.getUser({ or: "return-null" });
    if (!user) {
      signalConvexAuthReady(false);
    }
  } catch (error) {
    console.warn("[StackAuth] Unable to determine initial user state", error);
    signalConvexAuthReady(false);
  }
})();

const fetchWithAuth = (async (request: Request) => {
  const mergedHeaders = new Headers();
  try {
    const user = await stackClientApp.getUser({ or: "return-null" });
    if (user) {
      const authHeaders = await user.getAuthHeaders();
      for (const [key, value] of Object.entries(authHeaders)) {
        mergedHeaders.set(key, value);
      }
    }
  } catch (error) {
    console.error("[StackAuth] Failed to resolve auth headers", error);
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
