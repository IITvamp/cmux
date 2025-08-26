import * as fs from "node:fs";
import * as readline from "node:readline";

/**
 * Cursor agent completion detection based on stream-json output.
 * 
 * The Cursor Agent CLI outputs newline-delimited JSON (NDJSON) by default.
 * We look for the terminal result event with:
 * - type: "result"
 * - subtype: "success"
 * 
 * This event is emitted when the agent completes successfully.
 */

interface CursorResultEvent {
  type: string;
  subtype?: string;
  is_error?: boolean;
  duration_ms?: number;
  result?: string;
  session_id?: string;
  request_id?: string;
}

/**
 * Check if cursor agent has completed by looking for the terminal result event
 * @param taskRunId The task run ID to check for
 * @param logPath Optional path to the cursor output log file
 * @returns true if the completion event exists, false otherwise
 */
export async function checkCursorCompletion(
  taskRunId: string,
  logPath?: string
): Promise<boolean> {
  // Default log path based on task run ID if not provided
  const outputPath = logPath || `/root/.cursor/logs/${taskRunId}.jsonl`;
  
  try {
    // Check if the log file exists
    await fs.promises.access(outputPath);
    
    // Read the file line by line to find the terminal result event
    const fileStream = fs.createReadStream(outputPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const event = JSON.parse(line) as CursorResultEvent;
        
        // Check for terminal result event
        if (
          event.type === "result" && 
          event.subtype === "success" && 
          event.is_error === false
        ) {
          console.log(
            `[Cursor Detector] Found completion event for task ${taskRunId}:`,
            {
              duration_ms: event.duration_ms,
              session_id: event.session_id,
              result_preview: event.result?.substring(0, 100)
            }
          );
          rl.close();
          fileStream.destroy();
          return true;
        }
      } catch (parseError) {
        // Skip malformed JSON lines
        continue;
      }
    }
    
    return false;
  } catch (error) {
    // File doesn't exist or isn't readable yet
    return false;
  }
}

/**
 * Watch cursor output stream for completion in real-time
 * @param taskRunId The task run ID to watch for
 * @param onComplete Callback when completion is detected
 * @param logPath Optional path to the cursor output log file
 * @returns Function to stop watching
 */
export function watchCursorCompletion(
  taskRunId: string,
  onComplete: () => void,
  logPath?: string
): () => void {
  const outputPath = logPath || `/root/.cursor/logs/${taskRunId}.jsonl`;
  let watcher: fs.FSWatcher | null = null;
  let tailStream: readline.Interface | null = null;
  let fileStream: fs.ReadStream | null = null;
  let lastPosition = 0;
  let completed = false;
  
  const startWatching = () => {
    try {
      // Start reading from current position
      fileStream = fs.createReadStream(outputPath, {
        start: lastPosition,
        encoding: 'utf8'
      });
      
      tailStream = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      tailStream.on('line', (line) => {
        if (completed || !line.trim()) return;
        
        try {
          const event = JSON.parse(line) as CursorResultEvent;
          
          // Check for terminal result event
          if (
            event.type === "result" && 
            event.subtype === "success" && 
            event.is_error === false
          ) {
            console.log(
              `[Cursor Detector] Completion detected in real-time for task ${taskRunId}`
            );
            completed = true;
            stopWatching();
            onComplete();
          }
        } catch (parseError) {
          // Skip malformed JSON lines
        }
        
        // Update position for next read
        lastPosition += Buffer.byteLength(line + '\n');
      });
      
      // Watch for file changes
      watcher = fs.watch(outputPath, (eventType) => {
        if (eventType === 'change' && !completed) {
          // File changed, read new content
          if (tailStream) {
            tailStream.close();
          }
          if (fileStream) {
            fileStream.destroy();
          }
          startWatching();
        }
      });
    } catch (error) {
      // File doesn't exist yet, retry in a bit
      setTimeout(() => {
        if (!completed) {
          startWatching();
        }
      }, 1000);
    }
  };
  
  const stopWatching = () => {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
    if (tailStream) {
      tailStream.close();
      tailStream = null;
    }
    if (fileStream) {
      fileStream.destroy();
      fileStream = null;
    }
  };
  
  // Start watching
  startWatching();
  
  return stopWatching;
}

export default {
  checkCursorCompletion,
  watchCursorCompletion,
};