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
  // Subscribe so that log updates stream in real-time.
  const taskRun = useQuery(api.taskRuns.subscribe, {
    id: runId as Id<"taskRuns">,
  });

  const { terminals } = useTerminals();
  const terminal = terminals.get(runId);
  console.log("runid", runId);
  console.log("terminals", terminals);
  console.log("terminal", terminal);

  // const { terminal, isReady } = useTerminal({
  //   id: runId,
  //   name: `Task Run ${runId}`,
  //   autoCreate: false,
  // });

  // const terminalRef = useRef<HTMLDivElement>(null);
  // const isAttachedRef = useRef(false);
  // const lastLogLengthRef = useRef(0);

  // Attach terminal to DOM
  // useEffect(() => {
  //   if (!terminal || !terminalRef.current || isAttachedRef.current) return;

  //   terminal.xterm.open(terminalRef.current);
  //   isAttachedRef.current = true;
  //   terminal.elementRef = terminalRef.current;
  //   terminal.fitAddon.fit();

  //   const handleResize = () => {
  //     if (terminal.fitAddon) {
  //       terminal.fitAddon.fit();
  //     }
  //   };

  //   const resizeObserver = new ResizeObserver(handleResize);
  //   resizeObserver.observe(terminalRef.current);

  //   return () => {
  //     resizeObserver.disconnect();
  //   };
  // }, [terminal, isReady]);

  // Write log content to terminal
  // useEffect(() => {
  //   if (!terminal || !taskRun?.log) return;

  //   // Only write new content
  //   if (taskRun.log.length > lastLogLengthRef.current) {
  //     const newContent = taskRun.log.slice(lastLogLengthRef.current);
  //     terminal.xterm.write(newContent);
  //     lastLogLengthRef.current = taskRun.log.length;
  //   }
  // }, [terminal, taskRun?.log]);

  if (!taskRun) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
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
    </div>
  );
}
