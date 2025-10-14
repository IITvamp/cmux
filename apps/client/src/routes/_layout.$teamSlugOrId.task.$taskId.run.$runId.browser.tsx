import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import z from "zod";
import { PersistentWebView } from "@/components/persistent-webview";
import { getTaskRunBrowserPersistKey } from "@/lib/persistent-webview-keys";
import { toProxyWorkspaceUrl } from "@/lib/toProxyWorkspaceUrl";
import {
  TASK_RUN_IFRAME_ALLOW,
  TASK_RUN_IFRAME_SANDBOX,
} from "../lib/preloadTaskRunIframes";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
});

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/task/$taskId/run/$runId/browser"
)({
  component: BrowserPage,
  params: {
    parse: paramsSchema.parse,
    stringify: (params) => {
      return {
        taskId: params.taskId,
        runId: params.runId,
      };
    },
  },
  loader: async (opts) => {
    await Promise.all([
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.taskRuns.getByTask, {
          teamSlugOrId: opts.params.teamSlugOrId,
          taskId: opts.params.taskId,
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.tasks.getById, {
          teamSlugOrId: opts.params.teamSlugOrId,
          id: opts.params.taskId,
        })
      ),
    ]);
  },
});

function BrowserPage() {
  const { runId, teamSlugOrId, taskId } = Route.useParams();

  const taskRuns = useQuery(api.taskRuns.getByTask, {
    teamSlugOrId,
    taskId,
  });

  const selectedRun = useMemo(() => {
    return taskRuns?.find((run) => run._id === runId);
  }, [runId, taskRuns]);

  // Construct VNC URL for morph instances
  const vncUrl = useMemo(() => {
    const rawWorkspaceUrl = selectedRun?.vscode?.workspaceUrl ?? null;
    if (!rawWorkspaceUrl) {
      return null;
    }

    // Replace port 39378 with 39380 and add /vnc.html with auto-connect params
    const url = new URL(rawWorkspaceUrl);
    const port39378Url = url.href.replace(/:\d+/, ":39378");
    const port39380Url = port39378Url.replace(":39378", ":39380");

    // Add VNC query params for auto-connect and local scaling
    const vncFullUrl = `${port39380Url.replace(/\/$/, "")}/vnc.html?autoconnect=true&resize=scale`;

    return toProxyWorkspaceUrl(vncFullUrl);
  }, [selectedRun?.vscode?.workspaceUrl]);

  const persistKey = getTaskRunBrowserPersistKey(runId);
  const hasVnc = vncUrl !== null;

  return (
    <div className="pl-1 flex flex-col grow bg-neutral-50 dark:bg-black">
      <div className="flex flex-col grow min-h-0 border-l border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-row grow min-h-0 relative">
          {vncUrl ? (
            <PersistentWebView
              persistKey={persistKey}
              src={vncUrl}
              className="grow flex relative"
              iframeClassName="select-none"
              allow={TASK_RUN_IFRAME_ALLOW}
              sandbox={TASK_RUN_IFRAME_SANDBOX}
              retainOnUnmount
              suspended={!hasVnc}
            />
          ) : (
            <div className="grow flex items-center justify-center">
              <span className="text-sm text-neutral-500">
                Browser view not available
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
