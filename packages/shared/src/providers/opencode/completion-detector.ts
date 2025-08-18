import { promises as fs } from "node:fs";
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
      const entries = await fs.readdir(basePath);
      for (const entry of entries) {
        const storagePath = path.join(basePath, entry, "storage", "session");
        try {
          await fs.access(storagePath);
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
      const files = await fs.readdir(logDir);
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        const logPath = path.join(logDir, file);
        const stat = await fs.stat(logPath);
        
        // Skip old logs
        if (stat.mtime.getTime() < sinceMs) continue;
        
        const content = await fs.readFile(logPath, 'utf-8');
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
      const messageDirs = await fs.readdir(path.join(storageDir, "message")).catch(() => []);
      
      for (const sessionId of messageDirs) {
        const sessionMessageDir = path.join(storageDir, "message", sessionId);
        
        try {
          const messageFiles = await fs.readdir(sessionMessageDir);
          
          // Sort by name (usually includes timestamp) to get most recent first
          messageFiles.sort().reverse();
          
          for (const messageFile of messageFiles) {
            if (!messageFile.endsWith('.json')) continue;
            
            const messagePath = path.join(sessionMessageDir, messageFile);
            
            try {
              const content = await fs.readFile(messagePath, 'utf-8');
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
        const sessionFiles = await fs.readdir(sessionInfoDir);
        
        for (const sessionFile of sessionFiles) {
          if (!sessionFile.endsWith('.json')) continue;
          
          const sessionPath = path.join(sessionInfoDir, sessionFile);
          const stat = await fs.stat(sessionPath);
          
          // Skip old sessions
          if (stat.mtime.getTime() < sinceEpochMs) continue;
          
          try {
            const content = await fs.readFile(sessionPath, 'utf-8');
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