import { convexAuthReadyPromise } from "@/contexts/convex/convex-auth-ready";
import { ConvexClientProvider } from "@/contexts/convex/convex-client-provider";
import { RealSocketProvider } from "@/contexts/socket/real-socket-provider";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    const convexAuthReady = await convexAuthReadyPromise;
    if (!convexAuthReady) {
      console.log("[Route.beforeLoad] convexAuthReady:", convexAuthReady);
    }
  },
});

function Layout() {
  return (
    <ConvexClientProvider>
      <RealSocketProvider>
        <Outlet />
      </RealSocketProvider>
    </ConvexClientProvider>
  );
}
