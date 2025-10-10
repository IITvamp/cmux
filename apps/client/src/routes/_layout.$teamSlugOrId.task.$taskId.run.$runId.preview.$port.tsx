import { ElectronPreviewBrowser } from "@/components/electron-preview-browser";
import { getTaskRunPreviewPersistKey } from "@/lib/persistent-webview-keys";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Fragment, useMemo } from "react";
import z from "zod";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
  port: z.string(),
});

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/task/$taskId/run/$runId/preview/$port",
)({
  component: PreviewPage,
  params: {
    parse: paramsSchema.parse,
    stringify: (params) => {
      return {
        taskId: params.taskId,
        runId: params.runId,
        port: params.port,
      };
    },
  },
});

function PreviewPage() {
  const { taskId, teamSlugOrId, runId, port } = Route.useParams();

  const taskRuns = useQuery(api.taskRuns.getByTask, {
    teamSlugOrId,
    taskId,
  });

  // Get the specific run
  const selectedRun = useMemo(() => {
    return taskRuns?.find((run) => run._id === runId);
  }, [runId, taskRuns]);

  // Find the service URL for the requested port
  const previewUrl = useMemo(() => {
    if (!selectedRun?.networking) return null;
    const portNum = parseInt(port, 10);
    const service = selectedRun.networking.find(
      (s) => s.port === portNum && s.status === "running",
    );
    return service?.url;
  }, [selectedRun, port]);

  const persistKey = useMemo(() => {
    return getTaskRunPreviewPersistKey(runId, port);
  }, [runId, port]);

  const paneBorderRadius = 6;

  const environmentError = selectedRun?.environmentError;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-950">
      {environmentError ? (
        <EnvironmentErrorBanner
          environmentError={environmentError}
          port={port}
        />
      ) : null}
      <div className="flex-1 min-h-0">
        {previewUrl ? (
          <ElectronPreviewBrowser
            persistKey={persistKey}
            src={previewUrl}
            borderRadius={paneBorderRadius}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
                {selectedRun
                  ? `Port ${port} is not available for this run`
                  : "Loading..."}
              </p>
              {selectedRun?.networking && selectedRun.networking.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-neutral-400 dark:text-neutral-500">
                    Available ports:
                  </p>
                  <div className="flex justify-center gap-2">
                    {selectedRun.networking
                      .filter((s) => s.status === "running")
                      .map((service) => (
                        <span
                          key={service.port}
                          className="rounded px-2 py-1 text-xs bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
                        >
                          {service.port}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface EnvironmentErrorDetails {
  maintenanceError?: string;
  maintenanceSessionName?: string;
  maintenanceLogPath?: string;
  devError?: string;
  devSessionName?: string;
  devLogPath?: string;
}

function EnvironmentErrorBanner({
  environmentError,
  port,
}: {
  environmentError: EnvironmentErrorDetails;
  port: string;
}) {
  const sections: Array<{
    key: string;
    title: string;
    error?: string;
    sessionName?: string;
    logPath?: string;
  }> = [];

  if (
    environmentError.maintenanceError ||
    environmentError.maintenanceSessionName ||
    environmentError.maintenanceLogPath
  ) {
    sections.push({
      key: "maintenance",
      title: "Maintenance script",
      error: environmentError.maintenanceError,
      sessionName: environmentError.maintenanceSessionName,
      logPath: environmentError.maintenanceLogPath,
    });
  }

  if (
    environmentError.devError ||
    environmentError.devSessionName ||
    environmentError.devLogPath
  ) {
    sections.push({
      key: "dev",
      title: "Dev script",
      error: environmentError.devError,
      sessionName: environmentError.devSessionName,
      logPath: environmentError.devLogPath,
    });
  }

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Environment failed to start services for port {port}
        </h2>
        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
          One or more sandbox scripts exited early. Inspect the tmux session or
          log file to resolve the issue, then retry loading the preview.
        </p>
        <div className="mt-3 space-y-3">
          {sections.map((section) => (
            <Fragment key={section.key}>
              <div className="rounded-md border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/80">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                    {section.title}
                  </p>
                </div>
                {section.error ? (
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                    {section.error}
                  </p>
                ) : null}
                {section.sessionName ? (
                  <p className="mt-2 text-xs font-mono text-neutral-700 dark:text-neutral-200">
                    tmux attach -t {section.sessionName}
                  </p>
                ) : null}
                {section.logPath ? (
                  <p className="mt-1 text-xs font-mono text-neutral-700 dark:text-neutral-200">
                    tail -f {section.logPath}
                  </p>
                ) : null}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
