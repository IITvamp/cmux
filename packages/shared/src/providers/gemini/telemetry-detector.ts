import { promises as fs } from "node:fs";
import * as readline from "node:readline";
import { createReadStream } from "node:fs";

/**
 * Telemetry-based completion detection for Gemini CLI.
 * Monitors the telemetry log file for completion events.
 * 
 * Detects a log record where:
 *  - attributes["event.name"] === "gemini_cli.next_speaker_check"
 *  - attributes["result"] === "user"
 */

// Use a unique telemetry log path per task, preferring CMUX_TASK_RUN_ID when available
const CMUX_TASK_RUN_ID = process.env.CMUX_TASK_RUN_ID;
export const GEMINI_TELEMETRY_LOG_PATH = 
  (CMUX_TASK_RUN_ID
    ? `/tmp/gemini-telemetry-${CMUX_TASK_RUN_ID}.log`
    : "/tmp/gemini-telemetry.log");

interface TelemetryEvent {
  timestamp?: string;
  attributes?: Record<string, any>;
  resource?: {
    attributes?: Record<string, any>;
  };
  body?: {
    attributes?: Record<string, any>;
  };
  [key: string]: unknown;
}

/**
 * Parse a JSON object from a telemetry log line.
 * The telemetry file contains concatenated JSON objects without commas.
 */
function parseTelemetryLine(line: string): TelemetryEvent | null {
  try {
    // Try to parse as JSON
    return JSON.parse(line) as TelemetryEvent;
  } catch {
    // Not valid JSON
    return null;
  }
}

/**
 * Check if a telemetry event indicates completion.
 * Looks for gemini_cli.next_speaker_check event with result: "user"
 */
function isCompletionEvent(event: TelemetryEvent): boolean {
  if (!event || typeof event !== 'object') return false;
  
  // Check various possible attribute locations
  const attrs = event.attributes || 
                event.resource?.attributes || 
                event.body?.attributes || 
                (event as any)['attributes'];
  
  if (!attrs || typeof attrs !== 'object') return false;
  
  // Check for the specific event name
  const eventName = attrs['event.name'] || 
                   attrs.event?.name || 
                   attrs['event_name'];
  
  // Check for result
  const result = attrs['result'] || attrs.result;
  
  // Always log event names for debugging
  if (eventName) {
    console.log(`[Gemini Detector] Found event: ${eventName}, result: ${result}, attrs:`, attrs);
  }
  
  // Log specifically when we find a next_speaker_check event
  if (eventName === 'gemini_cli.next_speaker_check') {
    console.log(`[Gemini Detector] *** Found next_speaker_check event with result: ${result} ***`);
  }
  
  // Match the completion pattern
  return eventName === 'gemini_cli.next_speaker_check' && result === 'user';
}

/**
 * JSON Stream Parser for concatenated JSON objects without commas.
 * Tracks brace depth to identify complete JSON objects.
 */
class JsonStreamParser {
  private depth = 0;
  private inString = false;
  private escape = false;
  private collecting = false;
  private buf = '';
  private onObject: (obj: any) => void;

  constructor(onObject: (obj: any) => void) {
    this.onObject = onObject;
  }

  reset(): void {
    this.depth = 0;
    this.inString = false;
    this.escape = false;
    this.collecting = false;
    this.buf = '';
  }

  push(chunk: string): void {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      
      if (this.inString) {
        this.buf += ch;
        if (this.escape) {
          this.escape = false;
        } else if (ch === '\\') {
          this.escape = true;
        } else if (ch === '"') {
          this.inString = false;
        }
        continue;
      }
      
      // Not in string
      if (ch === '"') {
        this.inString = true;
        if (this.collecting) this.buf += ch;
        continue;
      }
      
      if (ch === '{') {
        if (!this.collecting) {
          this.collecting = true;
          this.buf = '{';
          this.depth = 1;
        } else {
          this.depth++;
          this.buf += ch;
        }
        continue;
      }
      
      if (ch === '}') {
        if (this.collecting) {
          this.depth--;
          this.buf += ch;
          if (this.depth === 0) {
            // Complete JSON object
            try {
              const obj = JSON.parse(this.buf);
              this.onObject(obj);
            } catch {
              // Ignore parse error; continue
            }
            this.collecting = false;
            this.buf = '';
          }
        }
        continue;
      }
      
      if (this.collecting) {
        this.buf += ch;
      }
    }
  }
}

/**
 * Read and parse the last portion of the telemetry file.
 */
async function readLastTelemetryEvents(filePath: string, maxBytes: number = 64 * 1024): Promise<TelemetryEvent[]> {
  const events: TelemetryEvent[] = [];
  
  try {
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    
    // Read the last chunk of the file
    const chunkSize = Math.min(fileSize, maxBytes);
    const buffer = Buffer.alloc(chunkSize);
    const fd = await fs.open(filePath, 'r');
    
    try {
      await fd.read(buffer, 0, chunkSize, Math.max(0, fileSize - chunkSize));
      const content = buffer.toString('utf-8');
      
      // Parse concatenated JSON objects
      const parser = new JsonStreamParser((obj) => {
        events.push(obj);
      });
      parser.push(content);
      
      console.log(`[Gemini Detector] JsonStreamParser found ${events.length} events`);
      
      // Also try line-by-line parsing as fallback
      if (events.length === 0) {
        console.log(`[Gemini Detector] JsonStreamParser found no events, trying line-by-line parsing`);
        const lines = content.split('\n');
        console.log(`[Gemini Detector] Found ${lines.length} lines in file`);
        let validJsonCount = 0;
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            try {
              const obj = JSON.parse(trimmed);
              events.push(obj);
              validJsonCount++;
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
        console.log(`[Gemini Detector] Line-by-line parsing found ${validJsonCount} valid JSON objects`);
      }
    } finally {
      await fd.close();
    }
  } catch (err) {
    console.log(`[Gemini Detector] Error reading telemetry file: ${err}`);
  }
  
  return events;
}

/**
 * Check if the Gemini telemetry log indicates completion.
 * Looks for gemini_cli.next_speaker_check event with result: "user"
 * 
 * @param telemetryPath - Path to the telemetry log file
 * @param minIdleTimeMs - Minimum idle time required after event
 * @param startTimeMs - Only consider events after this timestamp (to avoid false positives from previous runs)
 */
export async function checkGeminiTelemetryCompletion(
  telemetryPath: string = GEMINI_TELEMETRY_LOG_PATH,
  minIdleTimeMs: number = 5000,
  startTimeMs?: number
): Promise<boolean> {
  try {
    // Check if telemetry file exists
    await fs.access(telemetryPath);
    
    // Get file stats to check last modification time
    const stats = await fs.stat(telemetryPath);
    const lastModified = stats.mtime.getTime();
    const idleTime = Date.now() - lastModified;
    
    console.log(`[Gemini Detector] File stats: size=${stats.size}, lastModified=${new Date(lastModified).toISOString()}, idleTime=${idleTime}ms, minIdleTime=${minIdleTimeMs}ms`);
    
    // If the file hasn't been modified since before we started, it's stale
    if (startTimeMs && lastModified < startTimeMs) {
      console.log(`[Gemini Detector] File is stale (lastModified before startTime)`);
      return false;
    }
    
    // Don't require idle time - just look for the event
    // The idle time check was preventing detection when Gemini is still running
    // We only care if the completion event exists in the file
    
    // Read and parse the last portion of the telemetry file
    const events = await readLastTelemetryEvents(telemetryPath, 256 * 1024); // Read even more data
    
    console.log(`[Gemini Detector] Parsed ${events.length} events from telemetry file (file size: ${stats.size} bytes)`);
    
    if (events.length === 0) {
      console.log(`[Gemini Detector] No events found in telemetry file`);
      // Try to read raw content to debug
      try {
        const content = await fs.readFile(telemetryPath, 'utf-8');
        const preview = content.substring(0, 1000);
        console.log(`[Gemini Detector] Raw file preview (first 1000 chars): ${preview}`);
      } catch (e) {
        console.log(`[Gemini Detector] Could not read raw file: ${e}`);
      }
      return false;
    }
    
    // Check for completion events in reverse order (most recent first)
    let foundCompletion = false;
    let completionEventTime: number | undefined;
    
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      
      if (!event) continue;
      
      // Skip events from before the task started (if we have timestamps)
      if (startTimeMs && event.timestamp) {
        const eventTime = new Date(event.timestamp).getTime();
        if (!isNaN(eventTime) && eventTime < startTimeMs) {
          console.log(`[Gemini Detector] Skipping old event from before startTime`);
          continue; // Skip old events
        }
      }
      
      if (isCompletionEvent(event)) {
        // Found a completion event
        foundCompletion = true;
        if (event.timestamp) {
          completionEventTime = new Date(event.timestamp).getTime();
        }
        break;
      }
    }
    
    if (foundCompletion) {
      // Check if enough time has passed since the completion event
      if (completionEventTime && idleTime >= minIdleTimeMs) {
        console.log(`[Gemini Detector] ✅ Completion event found and idle time met`);
        return true;
      } else if (!completionEventTime) {
        // No timestamp on event, just check file idle time
        if (idleTime >= minIdleTimeMs) {
          console.log(`[Gemini Detector] ✅ Completion event found (no timestamp) and file idle`);
          return true;
        }
      }
      console.log(`[Gemini Detector] Completion event found but waiting for idle time (${idleTime}ms < ${minIdleTimeMs}ms)`);
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
 * Looks for gemini_cli.next_speaker_check event with result: "user"
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
    checkIntervalMs = 2000, // Check more frequently for better responsiveness
    maxRuntimeMs = 20 * 60 * 1000,
    minRuntimeMs = 10000, // Reduced minimum runtime since we check for specific event
    onComplete,
    onError,
  } = options;
  
  const startTime = Date.now();
  let intervalId: NodeJS.Timeout | null = null;
  let stopped = false;
  let foundCompletion = false;
  
  const checkCompletion = async () => {
    if (stopped || foundCompletion) return;
    
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
      
      // Check telemetry for completion with shorter idle time since we're looking for specific event
      const isComplete = await checkGeminiTelemetryCompletion(telemetryPath, 3000);
      
      if (isComplete && !foundCompletion) {
        foundCompletion = true;
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
