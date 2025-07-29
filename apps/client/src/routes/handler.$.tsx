import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/handler/$")({
  component: HandlerComponent,
});

function HandlerComponent() {
  // This is a catch-all route for Stack Auth handlers
  // Stack Auth will handle these routes internally through the StackProvider
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="mb-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Processing...</p>
      </div>
    </div>
  );
}