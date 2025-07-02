import { TerminalManager } from "@/components/TerminalManager";
import { TerminalContextProvider } from "@/contexts/TerminalContextProvider";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terminals")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <TerminalContextProvider>
      <div className="h-screen flex flex-col">
        <header className="app-header">
          <h1 className="">Terminal</h1>
        </header>
        <main className="grow">
          <TerminalManager />
        </main>
      </div>
    </TerminalContextProvider>
  );
}
