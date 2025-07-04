import { TerminalView } from "@/components/TerminalManager";
import { useTerminals } from "@/hooks/useTerminals";
import { createFileRoute } from "@tanstack/react-router";
import "@xterm/xterm/css/xterm.css";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { type Id } from "../../convex/_generated/dataModel";

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
      <div className="border-b border-neutral-200 dark:border-neutral-700 px-6 py-4">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Task Run Details
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Status: {taskRun.status}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex flex-col h-full space-y-6">
          <div>
            <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Prompt
            </h2>
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4">
              <pre className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                {taskRun.prompt}
              </pre>
            </div>
          </div>

          {taskRun.summary && (
            <div>
              <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Summary
              </h2>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {taskRun.summary}
              </div>
            </div>
          )}

          <div className="flex flex-col flex-1">
            <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Terminal Output
            </h2>
            {/* <div className="flex-1 min-h-0 bg-black rounded-lg overflow-hidden">
              <div className={`terminal-pane`}>
                <div
                  ref={terminalRef}
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#1e1e1e",
                  }}
                />
              </div>
            </div> */}

            {terminal ? (
              <TerminalView terminal={terminal} isActive={true} />
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
