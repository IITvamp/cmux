import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * Types for Codex rollout JSONL entries (best-effort, minimal fields)
 */
interface CodexFunctionCallEntry {
  type: "function_call";
  id?: string;
  name: string;
  arguments: string | object | undefined;
}

interface CodexFunctionCallOutputEntry {
  type: "function_call_output";
  call_id?: string;
  output?: string;
}

interface CodexMessageEntry {
  type: "message";
  role: "user" | "assistant" | string;
}

interface CodexReasoningEntry {
  type: "reasoning";
}

type CodexRolloutEntry =
  | CodexFunctionCallEntry
  | CodexFunctionCallOutputEntry
  | CodexMessageEntry
  | CodexReasoningEntry
  | { record_type: string } // state markers
  | Record<string, unknown>;

interface PlanItemArg {
  step: string;
  status: "pending" | "in_progress" | "completed" | string;
}

interface UpdatePlanArgsParsed {
  explanation?: string | null;
  plan?: PlanItemArg[];
}

/**
 * Parse the arguments field from an update_plan function call.
 * The "arguments" value is often a JSON-encoded string.
 */
function parseUpdatePlanArguments(args: unknown): UpdatePlanArgsParsed | null {
  try {
    if (typeof args === "string") {
      return JSON.parse(args) as UpdatePlanArgsParsed;
    }
    if (typeof args === "object" && args !== null) {
      return args as UpdatePlanArgsParsed;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

/**
 * Determine if a plan array represents completion (all steps completed, non-empty).
 */
function isPlanCompleted(plan: PlanItemArg[] | undefined): boolean {
  if (!plan || plan.length === 0) return false;
  return plan.every((p) => p.status === "completed");
}

/**
 * Find the most recent SessionConfigured session_id from codex-tui.log since a timestamp.
 * Returns the session_id string if found, otherwise null.
 */
export async function getLatestCodexSessionIdSince(
  sinceEpochMs: number
): Promise<string | null> {
  const logPath = path.join(os.homedir(), ".codex", "log", "codex-tui.log");
  try {
    const content = await fs.readFile(logPath, "utf-8");
    // Each line often begins with an ISO timestamp like 2025-08-12T23:31:09.919075Z
    // Then contains: handle_codex_event: SessionConfigured(SessionConfiguredEvent { session_id: <uuid>
    const lines = content.split("\n");
    let latest: { when: number; id: string } | null = null;
    const sessionRegex = /SessionConfigured\(SessionConfiguredEvent\s*\{\s*session_id:\s*([0-9a-fA-F-]{36})/;
    for (const line of lines) {
      const match = sessionRegex.exec(line);
      if (!match || !match[1]) continue;
      const id = match[1];
      // Extract timestamp prefix if present
      const tsMatch = line.match(/^(\x1B\[[0-9;]*m)?([0-9T:\-.]+Z)(.*)$/);
      let when = Date.now();
      if (tsMatch && tsMatch[2]) {
        const t = Date.parse(tsMatch[2]);
        if (!Number.isNaN(t)) when = t;
      }
      if (when >= sinceEpochMs) {
        if (!latest || when >= latest.when) latest = { when, id };
      }
    }
    return latest ? latest.id : null;
  } catch {
    return null;
  }
}

/**
 * Find the rollout JSONL path for a given session_id by scanning ~/.codex/sessions tree.
 */
export async function findCodexRolloutPathForSession(
  sessionId: string
): Promise<string | null> {
  const sessionsRoot = path.join(os.homedir(), ".codex", "sessions");
  async function* walk(dir: string): AsyncGenerator<string> {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      let stat;
      try {
        stat = await fs.stat(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        yield* walk(full);
      } else if (stat.isFile() && full.endsWith(".jsonl") && full.includes(sessionId)) {
        yield full;
      }
    }
  }
  for await (const file of walk(sessionsRoot)) {
    if (file.includes(sessionId)) return file;
  }
  return null;
}

/**
 * Read a rollout JSONL file and determine if the task is complete.
 * A task is considered complete when either:
 * 1. The latest update_plan has all steps marked as "completed"
 * 2. There's a final assistant message after the plan updates (indicating the task is done)
 */
export async function checkCodexRolloutCompletion(
  rolloutPath: string
): Promise<{ isComplete: boolean; latestPlan?: PlanItemArg[] }> {
  try {
    const content = await fs.readFile(rolloutPath, "utf-8");
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    console.log(`[Codex Detector] Processing ${lines.length} lines from rollout file`);
    
    let latestPlan: PlanItemArg[] | undefined;
    let updatePlanCount = 0;
    let lastFewEntries: string[] = [];
    let hasAssistantMessageAfterPlan = false;
    let lastUpdatePlanIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      try {
        const obj = JSON.parse(line) as CodexRolloutEntry;
        
        // Keep track of last 5 entries for debugging
        if (i >= lines.length - 5) {
          lastFewEntries.push(JSON.stringify({
            type: (obj as any).type,
            name: (obj as any).name,
            role: (obj as any).role,
          }).substring(0, 100));
        }
        
        if ((obj as CodexFunctionCallEntry).type === "function_call") {
          const fc = obj as CodexFunctionCallEntry;
          if (fc.name === "update_plan") {
            updatePlanCount++;
            lastUpdatePlanIndex = i;
            const parsed = parseUpdatePlanArguments(fc.arguments);
            if (parsed?.plan) {
              latestPlan = parsed.plan;
              console.log(`[Codex Detector] Found update_plan #${updatePlanCount} with ${parsed.plan.length} steps`);
              // Reset the assistant message flag when we see a new plan
              hasAssistantMessageAfterPlan = false;
            }
          }
        }
        
        // Check for assistant message after the last plan update
        if ((obj as CodexMessageEntry).type === "message" && 
            (obj as CodexMessageEntry).role === "assistant" &&
            i > lastUpdatePlanIndex && 
            lastUpdatePlanIndex !== -1) {
          hasAssistantMessageAfterPlan = true;
          console.log(`[Codex Detector] Found assistant message after plan update at index ${i}`);
        }
      } catch {
        // ignore malformed lines
      }
    }
    
    console.log(`[Codex Detector] Last few entries:`, lastFewEntries);
    console.log(`[Codex Detector] Total update_plan calls: ${updatePlanCount}`);
    console.log(`[Codex Detector] Has assistant message after plan: ${hasAssistantMessageAfterPlan}`);
    if (latestPlan) {
      console.log(`[Codex Detector] Latest plan steps:`, latestPlan.map(p => ({ step: p.step.substring(0, 50), status: p.status })));
    }

    // Consider task complete if either all steps are done OR there's a final assistant message
    const allStepsComplete = isPlanCompleted(latestPlan);
    const isComplete = allStepsComplete || hasAssistantMessageAfterPlan;
    
    console.log(`[Codex Detector] Completion decision: allStepsComplete=${allStepsComplete}, hasAssistantMessage=${hasAssistantMessageAfterPlan}, final=${isComplete}`);

    return { isComplete, latestPlan };
  } catch (err) {
    console.error(`[Codex Detector] Error reading rollout file:`, err);
    return { isComplete: false };
  }
}

/**
 * Full check that ties together log -> session_id -> rollout file -> plan completion.
 * Uses a sinceEpochMs threshold to disambiguate concurrent sessions.
 */
export async function checkCodexCompletionSince(
  sinceEpochMs: number
): Promise<{
  isComplete: boolean;
  sessionId?: string;
  rolloutPath?: string;
  latestPlan?: PlanItemArg[];
}> {
  // Debug logging
  console.log(`[Codex Detector] Checking for completion since ${new Date(sinceEpochMs).toISOString()}`);
  
  const sessionId = await getLatestCodexSessionIdSince(sinceEpochMs);
  if (!sessionId) {
    console.log(`[Codex Detector] No session ID found since ${sinceEpochMs}`);
    return { isComplete: false };
  }
  console.log(`[Codex Detector] Found session ID: ${sessionId}`);
  
  const rolloutPath = await findCodexRolloutPathForSession(sessionId);
  if (!rolloutPath) {
    console.log(`[Codex Detector] No rollout file found for session ${sessionId}`);
    return { isComplete: false, sessionId };
  }
  console.log(`[Codex Detector] Found rollout path: ${rolloutPath}`);
  
  const { isComplete, latestPlan } = await checkCodexRolloutCompletion(rolloutPath);
  console.log(`[Codex Detector] Completion check result:`, { isComplete, latestPlan });
  
  return { isComplete, sessionId, rolloutPath, latestPlan };
}

export interface CodexCompletionMonitorOptions {
  sinceEpochMs: number;
  checkIntervalMs?: number;
  maxRuntimeMs?: number;
  minRuntimeMs?: number;
  onComplete?: (data: {
    sessionId: string;
    rolloutPath: string;
    latestPlan?: PlanItemArg[];
  }) => void | Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * Monitor Codex for completion based on ~/.codex logs and rollout JSONL.
 */
export function monitorCodexCompletion(
  options: CodexCompletionMonitorOptions
): () => void {
  const {
    sinceEpochMs,
    checkIntervalMs = 5000,
    maxRuntimeMs = 20 * 60 * 1000,
    minRuntimeMs = 30000,
    onComplete,
    onError,
  } = options;

  const start = Date.now();
  let intervalId: NodeJS.Timeout | null = null;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const elapsed = Date.now() - start;
      if (elapsed < minRuntimeMs) return;
      if (elapsed > maxRuntimeMs) {
        stop();
        if (onError) onError(new Error(`Codex session exceeded max runtime of ${maxRuntimeMs}ms`));
        return;
      }
      const res = await checkCodexCompletionSince(sinceEpochMs);
      if (res.isComplete && res.sessionId && res.rolloutPath) {
        stop();
        if (onComplete) await onComplete({
          sessionId: res.sessionId,
          rolloutPath: res.rolloutPath,
          latestPlan: res.latestPlan,
        });
      }
    } catch (err) {
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  intervalId = setInterval(tick, checkIntervalMs);
  setTimeout(tick, minRuntimeMs);

  const stop = () => {
    stopped = true;
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  };
  return stop;
}

export default {
  getLatestCodexSessionIdSince,
  findCodexRolloutPathForSession,
  checkCodexRolloutCompletion,
  checkCodexCompletionSince,
  monitorCodexCompletion,
};

