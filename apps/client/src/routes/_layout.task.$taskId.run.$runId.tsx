import { TerminalView } from "@/components/TerminalManager";
import { useTerminals } from "@/hooks/useTerminals";
import { api } from "@coderouter/convex/api";
import { type Id } from "@coderouter/convex/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import "@xterm/xterm/css/xterm.css";
import { useQuery } from "convex/react";

export const Route = createFileRoute("/_layout/task/$taskId/run/$runId")({
  component: TaskRunComponent,
});

function TaskRunComponent() {
  const { runId } = Route.useParams();
  const taskRun = useQuery(api.taskRuns.subscribe, {
    id: runId as Id<"taskRuns">,
  });

  const { terminals } = useTerminals();
  const terminal = terminals.get(runId);

  return (
    <div className="flex flex-row h-full">
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col h-full space-y-6">
          <div className="flex flex-col flex-1 grow">
            {terminal ? (
              <div className="w-full h-full flex flex-col">
                <TerminalView terminal={terminal} isActive={true} />
              </div>
            ) : (
              <div className="flex-1 min-h-0 bg-black rounded-lg overflow-hidden">
                <div className="text-white">Loading...</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div>git diff</div>
    </div>
  );
}
