import { GitDiffView } from "@/components/GitDiffView";
import { OpenInEditorButton } from "@/components/OpenInEditorButton";
import { RestoredTerminalView } from "@/components/RestoredTerminalView";
import { TerminalView } from "@/components/TerminalView";
import { useTerminals } from "@/hooks/useTerminals";
import { api } from "@coderouter/convex/api";
import { type Id } from "@coderouter/convex/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import "@xterm/xterm/css/xterm.css";
import { useQuery } from "convex/react";

export const Route = createFileRoute("/_layout/task/$taskId/run/$runId")({
  component: TaskRunComponent,
});

function TaskGitDiffView({ runId }: { runId: string }) {
  const taskRun = useQuery(api.taskRuns.subscribe, {
    id: runId as Id<"taskRuns">,
  });
  const workspacePath = taskRun?.worktreePath;

  if (!workspacePath) {
    return (
      <div className="flex-1 min-h-0 bg-black overflow-hidden">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div className="absolute top-2 right-2 z-10">
        <OpenInEditorButton workspacePath={workspacePath} />
      </div>
      <GitDiffView workspacePath={workspacePath} className="h-full" />
    </div>
  );
}

function TaskRunComponent() {
  const { runId } = Route.useParams();
  const { terminals } = useTerminals();
  const terminal = terminals.get(runId);

  return (
    <div className="flex flex-row grow min-h-0">
      <div className="flex flex-col flex-1 overflow-hidden">
        {terminal ? (
          <TerminalView key={terminal.id} terminal={terminal} isActive={true} />
        ) : (
          <RestoredTerminalView runId={runId} />
        )}
      </div>
      <div className="flex-1 border-l">
        <TaskGitDiffView runId={runId} />
      </div>
    </div>
  );
}
