import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@cmux/convex/api";

export const Route = createFileRoute("/_layout/environments")({
  component: EnvironmentsList,
});

function EnvironmentsList() {
  const envs = useQuery(api.environment_morph.list, {});
  const navigate = useNavigate();

  return (
    <div className="flex flex-col grow overflow-auto bg-white dark:bg-black">
      <div className="p-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
        <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Environments</h1>
        <button
          onClick={() => navigate({ to: "/environments/new" })}
          className="px-3 py-1.5 text-sm rounded-md border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-800 dark:text-neutral-200"
        >
          New Environment
        </button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(envs ?? []).map((e) => (
            <Link
              key={e._id}
              to="/environments/$envId"
              params={{ envId: e._id as unknown as string }}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-950"
            >
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{e.name}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {e.provider ?? "morph"} · {e.status ?? "ready"}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

