import { useTheme } from "@/components/theme/use-theme";
import type { StackClientApp } from "@stackframe/react";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  auth: StackClientApp<true, string>;
}>()({
  component: RootComponent,
});

function ToasterWithTheme() {
  const { theme } = useTheme();
  return <Toaster richColors theme={theme} />;
}

function DevTools() {
  const [devToolsOpen, setDevToolsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === "i") {
        setDevToolsOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!devToolsOpen) {
    return null;
  }

  return (
    <>
      <TanStackRouterDevtools position="bottom-right" />
      <ReactQueryDevtools />
    </>
  );
}

function RootComponent() {
  const location = useRouterState({
    select: (state) => state.location,
  });

  useEffect(() => {
    console.log("[navigation] location-changed", {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      timestamp: new Date().toISOString(),
    });
  }, [location]);

  return (
    <>
      <Outlet />
      <DevTools />
      <ToasterWithTheme />
    </>
  );
}
