import { promises as fs } from "node:fs";
import * as readline from "node:readline";
import { createReadStream } from "node:fs";

/**
 * Telemetry-based completion detection for Gemini CLI.
 * Monitors the telemetry log file for completion events.
 */

export const GEMINI_TELEMETRY_LOG_PATH = "/tmp/gemini-telemetry.log";

interface TelemetryEvent {
  timestamp?: string;
  type?: string;
  event?: string;
  data?: any;
  [key: string]: unknown;
}

/**
 * Parse a line from the telemetry log file.
 * The format could be JSON, JSONL, or custom format.
 */
function parseTelemetryLine(line: string): TelemetryEvent | null {
  try {
    // Try to parse as JSON
    return JSON.parse(line) as TelemetryEvent;
  } catch {
    // If not JSON, try to extract structured data
    // Look for patterns like "event=finished" or "type=ServerGeminiFinishedEvent"
    const eventMatch = line.match(/(?:event|type)[=:]?\s*"?([^"\s]+)"?/i);
    const finishMatch = line.match(/finish(?:ed|Reason)?[=:]?\s*"?([^"\s]+)"?/i);
    
    if (eventMatch || finishMatch) {
      return {
        type: eventMatch?.[1] || "unknown",
        event: finishMatch?.[1] || eventMatch?.[1],
        raw: line
      };
    }
    
    return null;
  }
}

/**
 * Check if a telemetry event indicates completion.
 */
function isCompletionEvent(event: TelemetryEvent): boolean {
  // Check for various completion indicators
  const type = (event.type || "").toLowerCase();
  const eventName = (event.event || "").toLowerCase();
  const data = event.data || {};
  
  // Check for ServerGeminiFinishedEvent
  if (type.includes("servergeminfinished") || type.includes("finished")) {
    return true;
  }
  
  // Check for finish event
  if (eventName.includes("finish") || eventName.includes("complete") || eventName.includes("done")) {
    return true;
  }
  
  // Check for finish reason in data
  if (data.finishReason || data.finish_reason || data.FinishReason) {
    return true;
  }
  
  // Check for status indicators
  if (data.status === "completed" || data.status === "finished" || data.status === "done") {
    return true;
  }
  
  return false;
}

/**
 * Read the last N lines of a file efficiently.
 */
async function readLastLines(filePath: string, numLines: number = 100): Promise<string[]> {
  try {
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    
    // Read the last chunk of the file (up to 64KB)
    const chunkSize = Math.min(fileSize, 64 * 1024);
    const buffer = Buffer.alloc(chunkSize);
    const fd = await fs.open(filePath, 'r');
    
    try {
      await fd.read(buffer, 0, chunkSize, Math.max(0, fileSize - chunkSize));
      const content = buffer.toString('utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      return lines.slice(-numLines);
    } finally {
      await fd.close();
    }
  } catch (error) {
    return [];
  }
}

/**
 * Check if the Gemini telemetry log indicates completion.
 */
export async function checkGeminiTelemetryCompletion(
  telemetryPath: string = GEMINI_TELEMETRY_LOG_PATH,
  minIdleTimeMs: number = 5000
): Promise<boolean> {
  try {
    // Check if telemetry file exists
    await fs.access(telemetryPath);
    
    // Get file stats to check last modification time
    const stats = await fs.stat(telemetryPath);
    const lastModified = stats.mtime.getTime();
    const idleTime = Date.now() - lastModified;
    
    // Read the last 100 lines of the telemetry file
    const lastLines = await readLastLines(telemetryPath, 100);
    
    if (lastLines.length === 0) {
      return false;
    }
    
    // Check for completion events in reverse order (most recent first)
    for (let i = lastLines.length - 1; i >= 0; i--) {
      const line = lastLines[i];
      if (!line?.trim()) continue;
      
      const event = parseTelemetryLine(line);
      if (event && isCompletionEvent(event)) {
        // Found a completion event, check if enough time has passed
        return idleTime >= minIdleTimeMs;
      }
    }
    
    // No completion event found
    return false;
  } catch (error) {
    // File doesn't exist or other error
    return false;
  }
}

/**
 * Monitor the Gemini telemetry log for completion events.
 */
export function monitorGeminiTelemetry(options: {
  telemetryPath?: string;
  checkIntervalMs?: number;
  maxRuntimeMs?: number;
  minRuntimeMs?: number;
  onComplete?: () => void | Promise<void>;
  onError?: (error: Error) => void;
}): () => void {
  const {
    telemetryPath = GEMINI_TELEMETRY_LOG_PATH,
    checkIntervalMs = 3000,
    maxRuntimeMs = 20 * 60 * 1000,
    minRuntimeMs = 15000,
    onComplete,
    onError,
  } = options;
  
  const startTime = Date.now();
  let intervalId: NodeJS.Timeout | null = null;
  let stopped = false;
  
  const checkCompletion = async () => {
    if (stopped) return;
    
    try {
      const elapsed = Date.now() - startTime;
      
      // Don't check too early
      if (elapsed < minRuntimeMs) {
        return;
      }
      
      // Check for timeout
      if (elapsed > maxRuntimeMs) {
        stop();
        if (onError) {
          onError(new Error(`Gemini session exceeded max runtime of ${maxRuntimeMs}ms`));
        }
        return;
      }
      
      // Check telemetry for completion
      const isComplete = await checkGeminiTelemetryCompletion(telemetryPath, 5000);
      
      if (isComplete) {
        stop();
        if (onComplete) {
          await onComplete();
        }
      }
    } catch (error) {
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };
  
  // Start checking after minimum runtime
  setTimeout(() => {
    checkCompletion();
    intervalId = setInterval(checkCompletion, checkIntervalMs);
  }, minRuntimeMs);
  
  const stop = () => {
    stopped = true;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
  
  return stop;
}

/**
 * Stream telemetry events from the log file.
 */
export async function* streamGeminiTelemetryEvents(
  telemetryPath: string = GEMINI_TELEMETRY_LOG_PATH
): AsyncGenerator<TelemetryEvent> {
  const stream = createReadStream(telemetryPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    const event = parseTelemetryLine(line);
    if (event) {
      yield event;
    }
  }
}

export default {
  GEMINI_TELEMETRY_LOG_PATH,
  checkGeminiTelemetryCompletion,
  monitorGeminiTelemetry,
  streamGeminiTelemetryEvents,
};