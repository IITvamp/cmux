import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * OpenCode completion detection based on session/message JSON files.
 * 
 * OpenCode stores session state in JSON files under:
 * ~/.local/share/opencode/project/{workspace}/storage/session/
 * 
 * We look for messages with:
 * - time.completed field present (indicates message is done)
 * - role: "assistant" 
 * - No active tool use in progress
 */

interface OpenCodeMessage {
  id: string;
  role: string;
  time?: {
    created?: number;
    completed?: number;
  };
  tokens?: {
    input?: number;
    output?: number;
  };
  sessionID?: string;
}

interface OpenCodeSession {
  id: string;
  status?: string;
  messages?: string[];
  time?: {
    created?: number;
    updated?: number;
  };
}

/**
 * Find OpenCode storage directories
 */
async function findOpenCodeStorageDirs(): Promise<string[]> {
  const home = os.homedir();
  const dirs: string[] = [];
  
  // Common OpenCode storage locations
  const basePaths = [
    path.join(home, ".local", "share", "opencode", "project"),
    path.join(home, ".config", "opencode", "project"),
    path.join(home, ".opencode", "project"),
  ];
  
  for (const basePath of basePaths) {
    try {
      const entries = await fs.promises.readdir(basePath);
      for (const entry of entries) {
        const storagePath = path.join(basePath, entry, "storage", "session");
        try {
          await fs.promises.access(storagePath);
          dirs.push(storagePath);
        } catch {
          // Storage path doesn't exist
        }
      }
    } catch {
      // Base path doesn't exist
    }
  }
  
  return dirs;
}

/**
 * Check if a message indicates completion
 */
function isMessageComplete(message: OpenCodeMessage, sinceMs: number): boolean {
  // Must be from assistant
  if (message.role !== "assistant") return false;
  
  // Check if message has completed timestamp
  if (!message.time?.completed) return false;
  
  // Check if completion is after our start time
  if (message.time.completed < sinceMs) return false;
  
  console.log(`[OpenCode Detector] Found completed assistant message: ${message.id}, completed at ${new Date(message.time.completed).toISOString()}`);
  return true;
}

/**
 * Check OpenCode log files for completion patterns
 */
async function checkOpenCodeLogs(sinceMs: number): Promise<boolean> {
  const home = os.homedir();
  const logDirs = [
    path.join(home, ".local", "share", "opencode", "log"),
    path.join(home, ".config", "opencode", "log"),
    path.join(home, ".opencode", "log"),
  ];
  
  for (const logDir of logDirs) {
    try {
      const files = await fs.promises.readdir(logDir);
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        const logPath = path.join(logDir, file);
        const stat = await fs.promises.stat(logPath);
        
        // Skip old logs
        if (stat.mtime.getTime() < sinceMs) continue;
        
        const content = await fs.promises.readFile(logPath, 'utf-8');
        const lines = content.split('\n');
        
        // Look for session idle or finish events in the last 100 lines
        const recentLines = lines.slice(Math.max(0, lines.length - 100));
        
        for (const line of recentLines) {
          // Look for session idle or finish patterns
          if (line.includes('type=finish part') || 
              line.includes('type=session.idle') ||
              line.includes('session.idle publishing')) {
            
            // Extract timestamp if possible
            const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
            if (timestampMatch && timestampMatch[1]) {
              const eventTime = new Date(timestampMatch[1]).getTime();
              if (eventTime >= sinceMs) {
                console.log(`[OpenCode Detector] Found completion in log: ${line.substring(0, 100)}`);
                return true;
              }
            } else {
              // No timestamp, but file was modified recently, so likely current
              console.log(`[OpenCode Detector] Found completion pattern in log: ${line.substring(0, 100)}`);
              return true;
            }
          }
        }
      }
    } catch {
      // Log directory doesn't exist
    }
  }
  
  return false;
}

/**
 * Check for OpenCode completion by examining session and message files
 */
export async function checkOpencodeCompletionSince(
  sinceEpochMs: number,
  workingDir?: string
): Promise<boolean> {
  console.log(`[OpenCode Detector] Checking for completion since ${new Date(sinceEpochMs).toISOString()}`);
  
  // First check logs for completion patterns
  const logComplete = await checkOpenCodeLogs(sinceEpochMs);
  if (logComplete) {
    console.log(`[OpenCode Detector] ✅ Task completion detected from logs`);
    return true;
  }
  
  // Then check session storage
  const storageDirs = await findOpenCodeStorageDirs();
  
  if (storageDirs.length === 0) {
    console.log(`[OpenCode Detector] No storage directories found`);
    return false;
  }
  
  console.log(`[OpenCode Detector] Checking ${storageDirs.length} storage directories`);
  
  for (const storageDir of storageDirs) {
    try {
      // Check message directory for completed messages
      const messageDirs = await fs.promises
        .readdir(path.join(storageDir, "message"))
        .catch(() => []);
      
      for (const sessionId of messageDirs) {
        const sessionMessageDir = path.join(storageDir, "message", sessionId);
        
        try {
          const messageFiles = await fs.promises.readdir(sessionMessageDir);
          
          // Sort by name (usually includes timestamp) to get most recent first
          messageFiles.sort().reverse();
          
          for (const messageFile of messageFiles) {
            if (!messageFile.endsWith('.json')) continue;
            
            const messagePath = path.join(sessionMessageDir, messageFile);
            
            try {
              const content = await fs.promises.readFile(messagePath, 'utf-8');
              const message = JSON.parse(content) as OpenCodeMessage;
              
              if (isMessageComplete(message, sinceEpochMs)) {
                console.log(`[OpenCode Detector] ✅ Task completion detected in session ${sessionId}`);
                return true;
              }
            } catch {
              // Failed to parse message file
            }
          }
        } catch {
          // Failed to read session message directory
        }
      }
      
      // Also check session info files
      const sessionInfoDir = path.join(storageDir, "info");
      try {
        const sessionFiles = await fs.promises.readdir(sessionInfoDir);
        
        for (const sessionFile of sessionFiles) {
          if (!sessionFile.endsWith('.json')) continue;
          
          const sessionPath = path.join(sessionInfoDir, sessionFile);
          const stat = await fs.promises.stat(sessionPath);
          
          // Skip old sessions
          if (stat.mtime.getTime() < sinceEpochMs) continue;
          
          try {
            const content = await fs.promises.readFile(sessionPath, 'utf-8');
            const session = JSON.parse(content) as OpenCodeSession;
            
            // Check if session status indicates completion
            if (session.status === 'idle' || session.status === 'completed') {
              console.log(`[OpenCode Detector] ✅ Found ${session.status} session: ${session.id}`);
              return true;
            }
          } catch {
            // Failed to parse session file
          }
        }
      } catch {
        // Session info directory doesn't exist
      }
    } catch (error) {
      // Storage directory not accessible
      console.log(`[OpenCode Detector] Error checking storage dir: ${error}`);
    }
  }
  
  return false;
}

export default {
  checkOpencodeCompletionSince,
};

// Consolidated from completion-detection.ts
export type OpenCodeStdoutDetector = {
  push: (chunk: string) => void;
  stop: () => void;
};

export function createOpenCodeStdoutDetector(options: {
  startTime: number;
  onComplete: (data?: { reason?: string; elapsedMs: number }) => void;
  onError?: (err: Error) => void;
}): OpenCodeStdoutDetector {
  let buffer = "";
  let stopped = false;

  const finish = (reason?: string) => {
    if (stopped) return;
    stopped = true;
    try {
      options.onComplete({ reason, elapsedMs: Date.now() - options.startTime });
    } catch (e) {
      options.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  };

  return {
    push: (chunk: string) => {
      if (stopped) return;
      try {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let detected = false;
          let reason = "";

          if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
              const obj = JSON.parse(trimmed) as any;
              const payload = obj.payload || obj.event || obj;
              const done = payload?.Done === true || payload?.done === true;
              const type = String(payload?.Type || payload?.type || "").toLowerCase();
              const isResponse = type.includes("response");
              const isSummarize = type.includes("summarize");
              const finishInfo = payload?.finish || obj?.finish || obj?.response?.finish;
              reason = String(finishInfo?.reason || "").toLowerCase();
              if ((done && (isResponse || isSummarize)) || (finishInfo && reason !== "tool_use" && reason !== "")) {
                detected = true;
              }
            } catch {
              // fall through to regex
            }
          }
          if (!detected) {
            const doneRe = /\"?done\"?\s*:\s*true/i;
            const typeRe = /\"?type\"?\s*:\s*\"?([a-zA-Z_\-]+)\"?/i;
            const finishReasonRe = /finish[^\n\r]*?reason\s*[:=]\s*\"?([a-zA-Z_\-]+)\"?/i;
            const hasDone = doneRe.test(trimmed);
            const typeMatch = typeRe.exec(trimmed);
            const typeStr = (typeMatch?.[1] || "").toLowerCase();
            const isResponse = typeStr.includes("response");
            const isSummarize = typeStr.includes("summarize");
            const fr = finishReasonRe.exec(trimmed);
            reason = (fr?.[1] || reason || "").toLowerCase();
            if ((hasDone && (isResponse || isSummarize)) || (reason && reason !== "tool_use")) {
              detected = true;
            }
          }
          if (detected) {
            finish(reason);
            return;
          }
        }
      } catch (e) {
        options.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    },
    stop: () => {
      stopped = true;
    },
  };
}

export type StopFn = () => void;

export function watchOpenCodeMarkerFile(options: {
  taskRunId: string;
  onComplete: () => void | Promise<void>;
  onError?: (err: Error) => void;
}): StopFn {
  const { watch } = require("node:fs") as typeof import("node:fs");
  const { promises: fsp } = require("node:fs");
  const markerPath = `/root/lifecycle/opencode-complete-${options.taskRunId}`;
  let watcher: import("node:fs").FSWatcher | null = null;
  let stopped = false;

  const stop = () => {
    stopped = true;
    try {
      watcher?.close();
    } catch {}
    watcher = null;
  };

  (async () => {
    try {
      await fsp.access(markerPath);
      if (!stopped) {
        await options.onComplete();
        stop();
        return;
      }
    } catch {}
    try {
      watcher = watch(
        "/root/lifecycle",
        { persistent: false },
        async (_event, filename) => {
          if (stopped) return;
          if (filename?.toString() === `opencode-complete-${options.taskRunId}`) {
            try {
              await options.onComplete();
            } catch (e) {
              options.onError?.(e instanceof Error ? e : new Error(String(e)));
            }
            stop();
          }
        }
      );
    } catch (e) {
      options.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  })();

  return stop;
}

export function startOpenCodeCompletionDetector(
  taskRunId: string,
  onComplete: () => void
): void {
  // Keep simple: rely on marker-file based completion
  watchOpenCodeMarkerFile({ taskRunId, onComplete });
}
