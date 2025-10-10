import { useTheme } from "@/components/theme/use-theme";
import type { StackClientApp } from "@stackframe/react";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";

const AUTO_UPDATE_TOAST_ID = "auto-update-toast";

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

function useAutoUpdateNotifications() {
  useEffect(() => {
    const maybeWindow = typeof window === "undefined" ? undefined : window;
    const cmux = maybeWindow?.cmux;

    if (!cmux?.on) return;

    let lastToastKey: string | null = null;

    const acknowledgeToast = () => {
      const autoUpdate = cmux.autoUpdate;
      if (!autoUpdate?.acknowledgeToast) return;
      void autoUpdate
        .acknowledgeToast()
        .catch((error) =>
          console.error("Failed to acknowledge auto-update toast", error)
        );
    };

    const showToast = (version: string | null) => {
      const toastKey = JSON.stringify({ version });
      if (lastToastKey === toastKey) return;
      lastToastKey = toastKey;

      const versionLabel = version ? ` (${version})` : "";

      toast("New version available", {
        id: AUTO_UPDATE_TOAST_ID,
        duration: 30000,
        description: `Restart cmux to apply the latest version${versionLabel}.`,
        className: "select-none",
        action: cmux.autoUpdate
          ? {
              label: "Restart now",
              onClick: () => {
                void cmux.autoUpdate
                  .install()
                  .then((result) => {
                    if (result && !result.ok) {
                      const reason =
                        result.reason === "not-packaged"
                          ? "Updates can only be applied from the packaged app."
                          : "Failed to restart. Try again from the menu.";
                      toast.error(reason);
                    }
                  })
                  .catch((error) => {
                    console.error(
                      "Failed to trigger auto-update install",
                      error
                    );
                    toast.error("Couldn't restart. Try again from the menu.");
                  });
              },
            }
          : undefined,
      });
      acknowledgeToast();
    };

    const extractVersion = (payload: unknown): string | null => {
      if (
        payload &&
        typeof payload === "object" &&
        "version" in payload &&
        typeof (payload as { version?: unknown }).version === "string"
      ) {
        return (payload as { version: string }).version;
      }
      return null;
    };

    const handler = (payload: unknown) => {
      const version = extractVersion(payload);
      showToast(version);
    };

    const unsubscribe = cmux.on("auto-update:ready", handler);

    const autoUpdate = cmux.autoUpdate;
    if (autoUpdate?.getPendingToast) {
      void autoUpdate
        .getPendingToast()
        .then((response) => {
          if (response?.ok && response.toast) {
            handler(response.toast);
          }
        })
        .catch((error) => {
          console.error("Failed to retrieve pending auto-update state", error);
        });
    }

    return () => {
      try {
        unsubscribe?.();
      } catch {
        // ignore
      }
    };
  }, []);
}

function RootComponent() {
  const location = useRouterState({
    select: (state) => state.location,
  });

  useAutoUpdateNotifications();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[navigation] location-changed", {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        timestamp: new Date().toISOString(),
      });
    }
  }, [location]);

  return (
    <>
      <Outlet />
      <DevTools />
      <ToasterWithTheme />
    </>
  );
}
