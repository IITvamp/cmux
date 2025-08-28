import { convexQueryClient } from "@/contexts/convex/convex-query-client";
import { isElectron } from "@/lib/electron";
import { QueryClient } from "@tanstack/react-query";
import {
  createRouter as createTanStackRouter,
  createHashHistory,
} from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { routeTree } from "./routeTree.gen";

export function createRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      defaultPreload: "intent",
      context: { queryClient },
      scrollRestoration: true,
      // When running under Electron, use hash-based history so
      // file:// URLs don't break route matching in production builds.
      history: isElectron ? createHashHistory() : undefined,
    }),
    queryClient
  );

  return router;
}

export const router = createRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
