import { useStackApp } from "@stackframe/react";
import {
  createRouter as createTanStackRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { queryClient } from "./query-client";
import { routeTree } from "./routeTree.gen";

function createRouter() {
  const router = routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      defaultPreload: "intent",
      context: {
        queryClient: undefined!,
        auth: undefined!,
      },
      scrollRestoration: true,
    }),
    queryClient
  );

  return router;
}

const router = createRouter();

export function RouterProviderWithAuth() {
  const auth = useStackApp();
  return <RouterProvider router={router} context={{ queryClient, auth }} />;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
