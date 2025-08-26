import { EnvVarEditor, type EnvVar } from "@/components/environments/EnvVarEditor";
import { useSocket } from "@/contexts/socket/use-socket";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/environments/new")({
  component: NewEnvironment,
});

function NewEnvironment() {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [maintenanceScript, setMaintenanceScript] = useState("");
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!socket) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    socket.emit(
      "environment:create",
      {
        name,
        morphSnapshotId: snapshotId || undefined,
        maintenanceScript: maintenanceScript || undefined,
        secrets: envVars.filter((v) => v.key && v.value),
        provider: "morph",
      },
      (resp: { success: boolean; id?: string; error?: string }) => {
        setSubmitting(false);
        if (!resp.success) {
          toast.error(resp.error || "Failed to create environment");
          return;
        }
        toast.success("Environment created");
        navigate({ to: "/environments/$envId", params: { envId: resp.id! } });
      }
    );
  };

  return (
    <div className="flex flex-row grow h-dvh overflow-hidden bg-white dark:bg-black">
      <div className="w-[480px] max-w-[50%] border-r border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-4 overflow-auto">
        <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">New Environment</h1>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-600 dark:text-neutral-400">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Env"
            className="w-full px-3 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-600 dark:text-neutral-400">Morph Snapshot ID</label>
          <input
            value={snapshotId}
            onChange={(e) => setSnapshotId(e.target.value)}
            placeholder="snap_..."
            className="w-full px-3 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-600 dark:text-neutral-400">Maintenance Script</label>
          <textarea
            value={maintenanceScript}
            onChange={(e) => setMaintenanceScript(e.target.value)}
            placeholder="# shell script to run maintenance"
            className="w-full min-h-32 h-40 px-3 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 outline-none"
          />
        </div>

        <EnvVarEditor onChange={setEnvVars} />

        <div className="flex gap-2 mt-2">
          <button
            onClick={submit}
            disabled={submitting}
            className="px-3 py-1.5 text-sm rounded-md border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-800 dark:text-neutral-200 disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
      <div className="flex-1 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-sm text-neutral-500 dark:text-neutral-400">
          VSCode will appear here after provisioning.
        </div>
      </div>
    </div>
  );
}

