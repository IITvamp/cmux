import { EventEmitter } from "node:events";
import { watch, type FSWatcher } from "node:fs";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { parseJsonSafe, readJsonl } from "../../utils/jsonl.js";

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
  // Only accept explicit "completed" statuses to avoid false positives
  return plan.every((p) => String(p.status ?? "").toLowerCase().trim() === "completed");
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
 * Inspect codex-tui.log to determine if the session that started since `sinceEpochMs`
 * has emitted a TaskComplete event. We detect this by:
 * 1) Finding the last SessionConfigured(session_id) at or after sinceEpochMs
 * 2) Scanning subsequent lines until the next SessionConfigured for a TaskComplete marker
 */
export async function didLatestSessionCompleteInTuiLog(
  sinceEpochMs: number
): Promise<{ sessionId: string; completed: boolean } | null> {
  const logPath = path.join(os.homedir(), ".codex", "log", "codex-tui.log");
  try {
    const content = await fs.readFile(logPath, "utf-8");
    console.log(`[Codex Detector] Reading TUI log: ${logPath} (${content.length} bytes)`);
    const lines = content.split("\n");
    const sessionRegex = /SessionConfigured\(SessionConfiguredEvent\s*\{\s*session_id:\s*([0-9a-fA-F-]{36})/;
    const tsRegex = /^(\x1B\[[0-9;]*m)?([0-9T:\-.]+Z)(.*)$/;

    // Collect indices of SessionConfigured lines with timestamps
    const sessions: { idx: number; when: number; id: string }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string;
      const m = sessionRegex.exec(line);
      if (!m || !m[1]) continue;
      const tsMatch = line.match(tsRegex);
      let when = Date.now();
      if (tsMatch && tsMatch[2]) {
        const t = Date.parse(tsMatch[2]);
        if (!Number.isNaN(t)) when = t;
      }
      sessions.push({ idx: i, when, id: m[1] });
    }
    console.log(`[Codex Detector] Found ${sessions.length} SessionConfigured entries`);
    // Find the last SessionConfigured at or after sinceEpochMs
    const candidates = sessions.filter((s) => s.when >= sinceEpochMs);
    if (candidates.length === 0) return null;
    const latest = candidates.reduce((a, b) => (b.when >= a.when ? b : a));
    console.log(`[Codex Detector] Latest session since ${new Date(sinceEpochMs).toISOString()}:`, latest);

    // Determine the scan window end (next SessionConfigured or EOF)
    const nextSession = sessions.find((s) => s.idx > latest.idx);
    const startIdx = latest.idx + 1;
    const endIdx = nextSession ? nextSession.idx : lines.length;

    // Look for TaskComplete markers within the window
    const taskCompleteRegexes = [
      /TaskComplete\(/, // Debug print of enum variant
      /task_complete/, // JSON-style snake_case
    ];
    for (let i = startIdx; i < endIdx; i++) {
      const line = lines[i] as string;
      if (taskCompleteRegexes.some((r) => r.test(line))) {
        return { sessionId: latest.id, completed: true };
      }
    }
    console.log(
      `[Codex Detector] TaskComplete not found in window [${startIdx}, ${endIdx}); last 5 lines:`,
      lines.slice(Math.max(startIdx, endIdx - 5), endIdx)
    );
    return { sessionId: latest.id, completed: false };
  } catch {
    return null;
  }
}

/**
 * Check Codex notify sink file for agent-turn-complete markers.
 * Requires codex to be launched with: -c notify=["sh","-lc","mkdir -p /root/lifecycle && printf %s\\n \"$1\" | tee -a /root/lifecycle/codex-turns.jsonl >/dev/null"]
 */
export async function checkCodexNotifyFileCompletion(
  _workingDir: string,
  sinceEpochMs: number
): Promise<boolean> {
  // Always use the tmp lifecycle directory path (outside workspace)
  const filePath = "/tmp/cmux-lifecycle/codex-turns.jsonl";
  
  console.log(`[Codex Detector] Checking notify file: ${filePath}`);
  
  try {
    const stat = await fs.stat(filePath);
    console.log(`[Codex Detector] Notify file stats:`, {
      exists: true,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      mtimeMs: stat.mtime.getTime(),
      sinceEpochMs,
      isRecent: stat.mtime.getTime() >= sinceEpochMs
    });
    
    // Read all lines from the file
    const lines = await readJsonl(filePath);
    console.log(`[Codex Detector] Notify file has ${lines.length} lines`);
    
    // Parse each line and check for agent-turn-complete events
    let foundCompletion = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      try {
        const event = JSON.parse(line);
        
        // Check if this is an agent-turn-complete event
        if (event.type === "agent-turn-complete") {
          // Check if this event is after our start time
          const eventTime = event.timestamp || event.time || Date.now();
          if (eventTime >= sinceEpochMs) {
            console.log(`[Codex Detector] Found agent-turn-complete event at line ${i + 1}:`, event);
            foundCompletion = true;
            break;
          }
        }
      } catch (e) {
        // If parsing fails, fall back to string search
        if (line.includes('"type":"agent-turn-complete"')) {
          console.log(`[Codex Detector] Found agent-turn-complete marker (string match) at line ${i + 1}`);
          foundCompletion = true;
          break;
        }
      }
    }
    
    return foundCompletion;
  } catch (error) {
    // File doesn't exist yet - this is normal before any events are written
    if ((error as any).code === 'ENOENT') {
      console.log(`[Codex Detector] Notify file does not exist yet: ${filePath}`);
    } else {
      console.log(`[Codex Detector] Error checking notify file:`, error);
    }
    return false;
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
 * A task is considered complete when:
 * 1. The latest update_plan has all steps marked as "completed" OR
 * 2. There's a completion-indicating assistant message (e.g., "Task complete", "All done") 
 *    after plan updates AND sufficient time has passed since last activity
 */
export async function checkCodexRolloutCompletion(
  rolloutPath: string
): Promise<{ isComplete: boolean; latestPlan?: PlanItemArg[] }> {
  try {
    const lines = await readJsonl(rolloutPath);

    console.log(`[Codex Detector] Processing ${lines.length} lines from rollout file`);
    
    let latestPlan: PlanItemArg[] | undefined;
    let updatePlanCount = 0;
    let lastFewEntries: string[] = [];
    
    // (Idle detection removed by design)
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      try {
        const obj = parseJsonSafe<CodexRolloutEntry>(line);
        if (!obj) continue;
        
        // Keep track of last 5 entries for debugging
        if (i >= lines.length - 5) {
          lastFewEntries.push(JSON.stringify({
            type: (obj as any).type,
            name: (obj as any).name,
            role: (obj as any).role,
            content: (obj as any).content?.substring(0, 50),
          }).substring(0, 150));
        }
        
        if ((obj as CodexFunctionCallEntry).type === "function_call") {
          const fc = obj as CodexFunctionCallEntry;
          if (fc.name === "update_plan") {
            updatePlanCount++;
            const parsed = parseUpdatePlanArguments(fc.arguments);
            if (parsed?.plan) {
              latestPlan = parsed.plan;
              console.log(`[Codex Detector] Found update_plan #${updatePlanCount} with ${parsed.plan.length} steps`);
            }
          }
        }
        
        // Ignore assistant message tracking (no idle/phrase heuristics)

        // Do not use stop/finish markers alone; too noisy across tool phases
      } catch {
        // ignore malformed lines
      }
    }
    
    console.log(`[Codex Detector] Last few entries:`, lastFewEntries);
    console.log(`[Codex Detector] Total update_plan calls: ${updatePlanCount}`);
    if (latestPlan) {
      console.log(`[Codex Detector] Latest plan steps:`, latestPlan.map(p => ({ step: p.step.substring(0, 50), status: p.status })));
    }

    // Check if all steps are complete
    const allStepsComplete = isPlanCompleted(latestPlan);
    
    // Completion detection: strictly require latest plan to be all completed
    const isComplete = allStepsComplete;
    console.log(`[Codex Detector] Completion decision: allStepsComplete=${allStepsComplete}, final=${isComplete}`);

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
  // First: check codex-tui.log for an explicit TaskComplete for the latest session
  const tuiStatus = await didLatestSessionCompleteInTuiLog(sinceEpochMs);
  if (tuiStatus && tuiStatus.completed) {
    console.log(`[Codex Detector] TaskComplete detected in codex-tui.log for session ${tuiStatus.sessionId}`);
    const rolloutPath = await findCodexRolloutPathForSession(tuiStatus.sessionId);
    return { isComplete: true, sessionId: tuiStatus.sessionId, rolloutPath: rolloutPath ?? undefined };
  }

  // Fallback to plan-based rollout detection
  const sessionId = tuiStatus?.sessionId || (await getLatestCodexSessionIdSince(sinceEpochMs));
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

export class CodexCompletionDetector extends EventEmitter {
  private watchers: FSWatcher[] = [];
  private isRunning = false;
  private notifyFilePath = "/tmp/cmux-lifecycle/codex-turns.jsonl";
  private lastProcessedLine = 0;

  constructor(
    private options: {
      taskRunId: string;
      startTime: number;
      workingDir?: string;
    }
  ) {
    super();
    this.notifyFilePath = "/tmp/cmux-lifecycle/codex-turns.jsonl";
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[Codex Detector] Starting for task ${this.options.taskRunId}`);
    console.log(`[Codex Detector] Watching ${this.notifyFilePath}`);

    const hasCompletion = await this.checkNotifyFile();
    if (hasCompletion) {
      this.handleCompletion();
      return;
    }

    this.setupWatcher();
  }

  private setupWatcher(): void {
    const dir = path.dirname(this.notifyFilePath);
    const filename = path.basename(this.notifyFilePath);

    console.log(`[Codex Detector] Setting up watcher for ${filename} in ${dir}`);
    
    fs.mkdir(dir, { recursive: true })
      .then(() => console.log(`[Codex Detector] Ensured directory exists: ${dir}`))
      .catch(e => console.error(`[Codex Detector] Failed to create directory: ${e}`));

    const watcher = watch(dir, async (eventType, changedFile) => {
      console.log(`[Codex Detector] FS event: ${eventType} on ${changedFile} (looking for ${filename})`);
      if (changedFile === filename) {
        console.log(`[Codex Detector] Target file changed, checking for completion...`);
        const hasCompletion = await this.checkNotifyFile();
        if (hasCompletion) {
          this.handleCompletion();
        }
      }
    });

    watcher.on('error', (error) => {
      console.error(`[Codex Detector] Watcher error:`, error);
    });

    this.watchers.push(watcher);
  }

  private async checkNotifyFile(): Promise<boolean> {
    try {
      const lines = await readJsonl(this.notifyFilePath);
      
      for (let i = this.lastProcessedLine; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const event = parseJsonSafe<any>(line);
        
        if (event) {
          if (event.type === "agent-turn-complete") {
            const eventTime = event.timestamp || event.time || Date.now();
            if (eventTime >= this.options.startTime) {
              console.log(`[Codex Detector] Found agent-turn-complete at line ${i + 1}`);
              this.lastProcessedLine = i + 1;
              return true;
            }
          }
        } else {
          if (line.includes('"type":"agent-turn-complete"')) {
            console.log(`[Codex Detector] Found agent-turn-complete (string match) at line ${i + 1}`);
            this.lastProcessedLine = i + 1;
            return true;
          }
        }
      }

      this.lastProcessedLine = lines.length;
      return false;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log(`[Codex Detector] Notify file does not exist yet`);
      } else {
        console.error(`[Codex Detector] Error reading notify file:`, error);
      }
      return false;
    }
  }

  private handleCompletion(): void {
    if (!this.isRunning) return;
    
    const elapsedMs = Date.now() - this.options.startTime;
    console.log(`[Codex Detector] Task completed after ${elapsedMs}ms`);
    
    this.stop();
    this.emit("complete", {
      taskRunId: this.options.taskRunId,
      elapsedMs,
      detectionMethod: "notify-file"
    });
  }

  stop(): void {
    this.isRunning = false;
    this.watchers.forEach(w => {
      try {
        w.close();
      } catch (e) {}
    });
    this.watchers = [];
  }
}

export async function createCodexDetector(options: {
  taskRunId: string;
  startTime: number;
  workingDir?: string;
  onComplete: (data: { taskRunId: string; elapsedMs: number; detectionMethod: string }) => void;
  onError?: (error: Error) => void;
}): Promise<CodexCompletionDetector> {
  const detector = new CodexCompletionDetector({
    taskRunId: options.taskRunId,
    startTime: options.startTime,
    workingDir: options.workingDir,
  });

  detector.on("complete", options.onComplete);
  if (options.onError) {
    detector.on("error", options.onError);
  }

  await detector.start();
  return detector;
}

export default {
  getLatestCodexSessionIdSince,
  findCodexRolloutPathForSession,
  checkCodexRolloutCompletion,
  checkCodexCompletionSince,
  didLatestSessionCompleteInTuiLog,
  checkCodexNotifyFileCompletion,
};
