import { client } from "@cmux/www-openapi-client/client.gen";
import { StackClientApp } from "@stackframe/react";
import { useNavigate as useTanstackNavigate } from "@tanstack/react-router";
import { env } from "../client-env";
import { signalConvexAuthReady } from "../contexts/convex/convex-auth-ready";
import { convexQueryClient } from "../contexts/convex/convex-query-client";

export const stackClientApp = new StackClientApp({
  projectId: env.VITE_STACK_PROJECT_ID,
  publishableClientKey: env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
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

void stackClientApp.getUser().then(async (user) => {
  if (!user) {
    signalConvexAuthReady(false);
    return;
  }
  const authJson = await user.getAuthJson();
  if (!authJson.accessToken) {
    signalConvexAuthReady(false);
    return;
  }
  convexQueryClient.convexClient.setAuth(
    async () => authJson.accessToken,
    (isAuthenticated) => {
      signalConvexAuthReady(isAuthenticated);
    }
  );
});

client.setConfig({
  baseUrl: "http://localhost:9779",
  fetch: async (request) => {
    console.time("stackClientApp.getUser");
    const user = await stackClientApp.getUser();
    console.timeEnd("stackClientApp.getUser");
    if (!user) {
      throw new Error("User not found");
    }
    console.time("user.getAuthHeaders");
    const authHeaders = await user.getAuthHeaders();
    console.timeEnd("user.getAuthHeaders");
    const headers =
      request instanceof Request ? request.headers : new Headers();
    const response = await fetch(request, {
      headers: {
        ...headers,
        ...authHeaders,
      },
    });
    return response;
  },
});
