import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootComponent,
});

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
  return (
    <div className="flex flex-col">
      {/* <TitleBar /> */}
      <div className="flex flex-col grow overflow-hidden h-screen">
        <Outlet />
      </div>
      <DevTools />
      <Toaster richColors theme="system" />
    </div>
  );
}
