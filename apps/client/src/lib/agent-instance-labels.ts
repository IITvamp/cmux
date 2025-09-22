import type { Id } from "@cmux/convex/dataModel";

export interface AgentInstanceInfo {
  index: number;
  total: number;
}

type RunLike = {
  _id: Id<"taskRuns">;
  agentName?: string | null;
};

function normalizeAgentName(name?: string | null): string | null {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/**
 * Compute per-run agent instance indices for a presentation-ordered list of runs.
 * Entries are only created when the corresponding agent appears multiple times.
 */
export function computeAgentInstanceMap<T extends RunLike>(
  runs: readonly T[]
): Map<Id<"taskRuns">, AgentInstanceInfo> {
  const totals = new Map<string, number>();
  for (const run of runs) {
    const name = normalizeAgentName(run.agentName);
    if (!name) continue;
    totals.set(name, (totals.get(name) ?? 0) + 1);
  }

  const counts = new Map<string, number>();
  const result = new Map<Id<"taskRuns">, AgentInstanceInfo>();
  for (const run of runs) {
    const name = normalizeAgentName(run.agentName);
    if (!name) continue;
    const total = totals.get(name) ?? 1;
    if (total <= 1) continue;
    const index = (counts.get(name) ?? 0) + 1;
    counts.set(name, index);
    result.set(run._id, { index, total });
  }

  return result;
}

export function formatAgentNameWithInstance(
  agentName: string,
  instance?: AgentInstanceInfo
): string {
  if (!instance) return agentName;
  return `${agentName} (${instance.index})`;
}
