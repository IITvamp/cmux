import { Suspense } from "react";
import { AppLoginClient } from "./scopes.client";

export default function AppLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-neutral-50 dark:bg-neutral-900">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Authenticating...</h1>
            <p className="text-neutral-600 dark:text-neutral-400">Redirecting to cmux app...</p>
          </div>
        </div>
      }
    >
      <AppLoginClient />
    </Suspense>
  );
}
