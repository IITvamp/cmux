import { FloatingPane } from "@/components/floating-pane";
import { stackClientApp } from "@/lib/stack";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/debug")({
  component: DebugComponent,
});

function DebugComponent() {
  return (
    <FloatingPane>
      <div className="p-4">
        <button
          onClick={async () => {
            const user = await stackClientApp.getUser();
            if (!user) {
              throw new Error("No user");
            }
            const authHeaders = await user.getAuthHeaders();
            fetch("http://localhost:9779/api/user", {
              headers: {
                ...authHeaders,
              },
            })
              .then((res) => res.text())
              .then((data) => console.log(data));
          }}
        >
          Get user
        </button>
      </div>
    </FloatingPane>
  );
}
