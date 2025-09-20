import { CreateTeamDialogProvider } from "@/components/team/CreateTeamDialogProvider";
import { convexAuthReadyPromise } from "@/contexts/convex/convex-auth-ready";
import { ConvexClientProvider } from "@/contexts/convex/convex-client-provider";
import { RealSocketProvider } from "@/contexts/socket/real-socket-provider";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    const ok = await convexAuthReadyPromise;
    console.log("[Route.beforeLoad] convexAuthReady:", ok);
  },
});

function Layout() {
  return (
    <ConvexClientProvider>
      <RealSocketProvider>
        <CreateTeamDialogProvider>
          <Outlet />
        </CreateTeamDialogProvider>
      </RealSocketProvider>
    </ConvexClientProvider>
  );
}
