import { EnvVarEditor, type EnvVar } from "@/components/environments/EnvVarEditor";
import { useSocket } from "@/contexts/socket/use-socket";
import { api } from "@cmux/convex/api";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/environments/$envId")({
  component: EnvironmentDetail,
});

function EnvironmentDetail() {
  const { envId } = Route.useParams();
  const env = useQuery(api.environment_morph.get, { id: envId as any });
  const updateEnv = useMutation(api.environment_morph.update);
  const { socket } = useSocket();
  const [saving, setSaving] = useState(false);
  const [script, setScript] = useState(env?.maintenanceScript ?? "");
  useEffect(() => {
    setScript(env?.maintenanceScript ?? "");
  }, [env?.maintenanceScript]);

  const secretKeys = useMemo(() => (env?.secrets ?? []).map((s) => s.key), [env]);

  const saveScript = async () => {
    if (!env) return;
    setSaving(true);
    try {
      await updateEnv({ id: env._id as any, maintenanceScript: script });
      toast.success("Saved maintenance script");
    } catch (e) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const onAddVars = async (vars: EnvVar[]) => {
    if (!socket) return;
    const toSend = vars.filter((v) => v.key && v.value);
    if (toSend.length === 0) return;
    socket.emit("environment:upsert-secrets", { envId, secrets: toSend }, (resp: { success: boolean; error?: string }) => {
      if (!resp.success) {
        toast.error(resp.error || "Failed to save secrets");
      } else {
        toast.success("Secrets saved");
      }
    });
  };

  const vscodeUrl = env?.vscode?.workspaceUrl;

  return (
    <div className="flex flex-row grow h-dvh overflow-hidden bg-white dark:bg-black">
      <div className="w-[520px] max-w-[50%] border-r border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-4 overflow-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{env?.name || "Environment"}</h1>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{env?.provider ?? "morph"} · {env?.status ?? "ready"}</span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-600 dark:text-neutral-400">Maintenance Script</label>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="# shell script to run maintenance"
            className="w-full min-h-40 h-56 px-3 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={saveScript}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded-md border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-800 dark:text-neutral-200 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Secrets</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Existing keys: {secretKeys.length > 0 ? secretKeys.join(", ") : "None"}. Values are encrypted and cannot be viewed.
          </div>
          <EnvVarEditor onChange={onAddVars} />
        </div>
      </div>
      <div className="flex-1 bg-neutral-50 dark:bg-neutral-950">
        {vscodeUrl ? (
          <iframe
            src={vscodeUrl}
            className="w-full h-full border-0"
            title="VSCode"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            VSCode will appear here when available.
          </div>
        )}
      </div>
    </div>
  );
}
