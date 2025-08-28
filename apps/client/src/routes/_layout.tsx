import ConvexClientProvider from "@/contexts/convex/convex-client-provider";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout")({
  component: () => (
    <ConvexClientProvider>
      <Outlet />
    </ConvexClientProvider>
  ),
});
