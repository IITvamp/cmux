import { Sidebar } from "@/components/Sidebar";
import { api } from "@cmux/convex/api";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Suspense } from "react";

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
  loader: async ({ context }) => {
    void context.queryClient.ensureQueryData(convexQuery(api.tasks.get, {}));
  },
});

function LayoutComponent() {
  return (
    <>
      <div className="flex flex-row grow bg-white dark:bg-black">
        <Sidebar />

        {/* <div className="flex flex-col grow overflow-hidden bg-white dark:bg-neutral-950"> */}
        <Suspense fallback={<div>Loading...</div>}>
          <Outlet />
        </Suspense>
        {/* </div> */}
      </div>

      <button
        onClick={() => {
          const msg = window.prompt("Enter debug note");
          if (msg) {
            // Prefix allows us to easily grep in the console.

            console.log(`[USER NOTE] ${msg}`);
          }
        }}
        className="hidden"
        style={{
          position: "fixed",
          bottom: "16px",
          right: "16px",
          zIndex: 9999,
          background: "#ffbf00",
          color: "#000",
          border: "none",
          borderRadius: "4px",
          padding: "8px 12px",
          cursor: "default",
          fontSize: "12px",
          fontWeight: 600,
          boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
        }}
      >
        Add Debug Note
      </button>
    </>
  );
}
