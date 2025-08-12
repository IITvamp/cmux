import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * Interface for a parsed Claude JSONL message
 */
interface ClaudeMessage {
  type: "user" | "assistant" | "system";
  timestamp?: string;
  content?: string;
  [key: string]: unknown;
}

/**
 * Get the Claude project directory path for a given working directory
 * @param workingDir The working directory path (e.g., "/root/workspace")
 * @returns The Claude project directory path
 */
export function getClaudeProjectPath(workingDir: string): string {
  const homeDir = os.homedir();
  // Claude stores project files in ~/.claude/projects/{encoded-path}/
  // Replace forward slashes with hyphens to encode the path
  const encodedPath = workingDir.replace(/\//g, "-");
  return path.join(homeDir, ".claude", "projects", encodedPath);
}

/**
 * Get the most recent JSONL file from the Claude project directory
 * @param projectDir The Claude project directory path
 * @returns The path to the most recent JSONL file, or null if none found
 */
async function getMostRecentJsonlFile(projectDir: string): Promise<string | null> {
  try {
    // Check if project directory exists
    await fs.access(projectDir);
    
    // Get the most recent JSONL file
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files
      .filter((f) => f.endsWith(".jsonl"))
      .sort((a, b) => b.localeCompare(a)); // Sort by name (most recent first)

    if (jsonlFiles.length === 0) {
      return null;
    }

    const firstFile = jsonlFiles[0];
    if (!firstFile) {
      return null;
    }

    return path.join(projectDir, firstFile);
  } catch {
    // Directory doesn't exist or other error
    return null;
  }
}

/**
 * Parse the last message from a Claude JSONL file
 * @param filePath The path to the JSONL file
 * @returns The last message, or null if unable to parse
 */
async function getLastMessage(filePath: string): Promise<ClaudeMessage | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    
    if (lines.length === 0) {
      return null;
    }

    const lastLine = lines[lines.length - 1];
    if (!lastLine) {
      return null;
    }

    try {
      const lastMessage = JSON.parse(lastLine) as ClaudeMessage;
      return lastMessage;
    } catch {
      // Failed to parse JSON
      return null;
    }
  } catch {
    // Failed to read file
    return null;
  }
}

/**
 * Check if a Claude session is complete based on JSONL files
 * 
 * Claude completion detection logic:
 * - If the last message in the JSONL file is from the assistant, the task is complete
 * - If Claude is still working, there would be a user message after (with tool results)
 * 
 * @param projectPath The Claude project directory path (or use workingDir to auto-compute)
 * @param workingDir Optional working directory to compute project path from
 * @returns true if the session is complete, false otherwise
 */
export async function checkClaudeProjectFileCompletion(
  projectPath?: string,
  workingDir?: string
): Promise<boolean> {
  // Compute project path if not provided
  const projectDir = projectPath || (workingDir ? getClaudeProjectPath(workingDir) : null);
  
  if (!projectDir) {
    throw new Error("Either projectPath or workingDir must be provided");
  }

  // Get the most recent JSONL file
  const jsonlFile = await getMostRecentJsonlFile(projectDir);
  if (!jsonlFile) {
    // No JSONL files found - Claude hasn't started yet
    return false;
  }

  // Get the last message from the file
  const lastMessage = await getLastMessage(jsonlFile);
  if (!lastMessage) {
    // Unable to parse last message
    return false;
  }

  // If the last message is from assistant, task is complete
  // (If Claude is still working, there would be a user message with tool results after)
  return lastMessage.type === "assistant";
}

/**
 * Options for monitoring Claude completion
 */
export interface ClaudeCompletionMonitorOptions {
  workingDir: string;
  checkIntervalMs?: number;
  maxRuntimeMs?: number;
  minRuntimeMs?: number;
  onComplete?: () => void | Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * Monitor a Claude session for completion
 * Returns a function to stop monitoring
 */
export function monitorClaudeCompletion(
  options: ClaudeCompletionMonitorOptions
): () => void {
  const {
    workingDir,
    checkIntervalMs = 5000,
    maxRuntimeMs = 20 * 60 * 1000, // 20 minutes
    minRuntimeMs = 30000, // 30 seconds
    onComplete,
    onError,
  } = options;

  const startTime = Date.now();
  const projectPath = getClaudeProjectPath(workingDir);
  let intervalId: NodeJS.Timeout | null = null;
  let stopped = false;

  const checkCompletion = async () => {
    if (stopped) return;

    try {
      const elapsedMs = Date.now() - startTime;
      
      // Don't consider task complete too early
      if (elapsedMs < minRuntimeMs) {
        return;
      }

      // Check if max runtime exceeded
      if (elapsedMs > maxRuntimeMs) {
        stop();
        if (onError) {
          onError(new Error(`Claude session exceeded max runtime of ${maxRuntimeMs}ms`));
        }
        return;
      }

      // Check if Claude session is complete
      const isComplete = await checkClaudeProjectFileCompletion(projectPath);
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

  // Start monitoring
  intervalId = setInterval(checkCompletion, checkIntervalMs);
  
  // Also check immediately (after min runtime)
  setTimeout(checkCompletion, minRuntimeMs);

  // Return stop function
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
 * Get information about the Claude session state
 */
export interface ClaudeSessionInfo {
  projectPath: string;
  hasProjectDir: boolean;
  jsonlFiles: string[];
  mostRecentFile: string | null;
  lastMessage: ClaudeMessage | null;
  isComplete: boolean;
}

/**
 * Get detailed information about a Claude session
 */
export async function getClaudeSessionInfo(workingDir: string): Promise<ClaudeSessionInfo> {
  const projectPath = getClaudeProjectPath(workingDir);
  
  let hasProjectDir = false;
  let jsonlFiles: string[] = [];
  let mostRecentFile: string | null = null;
  let lastMessage: ClaudeMessage | null = null;
  let isComplete = false;

  try {
    await fs.access(projectPath);
    hasProjectDir = true;
    
    const files = await fs.readdir(projectPath);
    jsonlFiles = files
      .filter((f) => f.endsWith(".jsonl"))
      .sort((a, b) => b.localeCompare(a));
    
    if (jsonlFiles.length > 0) {
      const firstFile = jsonlFiles[0];
      if (firstFile) {
        mostRecentFile = path.join(projectPath, firstFile);
        lastMessage = await getLastMessage(mostRecentFile);
        isComplete = lastMessage?.type === "assistant";
      }
    }
  } catch {
    // Project directory doesn't exist
  }

  return {
    projectPath,
    hasProjectDir,
    jsonlFiles,
    mostRecentFile,
    lastMessage,
    isComplete,
  };
}

/**
 * Export all functions and types for convenience
 */
export default {
  getClaudeProjectPath,
  checkClaudeProjectFileCompletion,
  monitorClaudeCompletion,
  getClaudeSessionInfo,
};