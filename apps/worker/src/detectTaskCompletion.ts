import { promises as fs } from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import os from "node:os";

interface TaskCompletionOptions {
  taskId: string;
  agentType: "claude" | "codex" | "gemini" | "amp" | "opencode";
  workingDir: string;
  checkIntervalMs?: number;
  maxRuntimeMs?: number;
  minRuntimeMs?: number;
}

interface CompletionIndicator {
  stopReason?: string;
  status?: string;
  completed?: boolean;
}

export class TaskCompletionDetector extends EventEmitter {
  private checkInterval: NodeJS.Timeout | null = null;
  private startTime: number;
  private isRunning = false;
  private lastCheckedFile: string | null = null;
  private lastCheckedPosition = 0;

  constructor(private options: TaskCompletionOptions) {
    super();
    this.startTime = Date.now();
    this.options.checkIntervalMs = this.options.checkIntervalMs || 5000; // Check every 5 seconds
    this.options.maxRuntimeMs = this.options.maxRuntimeMs || 20 * 60 * 1000; // 20 minutes max
    this.options.minRuntimeMs = this.options.minRuntimeMs || 30000; // 30 seconds minimum
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.checkInterval = setInterval(async () => {
      try {
        const isComplete = await this.checkCompletion();
        if (isComplete) {
          this.stop();
          this.emit("task-complete", {
            taskId: this.options.taskId,
            agentType: this.options.agentType,
            elapsedMs: Date.now() - this.startTime,
          });
        } else if (Date.now() - this.startTime > this.options.maxRuntimeMs!) {
          this.stop();
          this.emit("task-timeout", {
            taskId: this.options.taskId,
            agentType: this.options.agentType,
            elapsedMs: Date.now() - this.startTime,
          });
        }
      } catch (error) {
        console.error(`Error checking task completion: ${error}`);
      }
    }, this.options.checkIntervalMs);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
  }

  private async checkCompletion(): Promise<boolean> {
    // Don't consider task complete too early
    if (Date.now() - this.startTime < this.options.minRuntimeMs!) {
      return false;
    }

    switch (this.options.agentType) {
      case "claude":
        return await this.checkClaudeCompletion();
      case "codex":
        return await this.checkCodexCompletion();
      case "gemini":
        return await this.checkGeminiCompletion();
      case "amp":
        return await this.checkAmpCompletion();
      case "opencode":
        return await this.checkOpencodeCompletion();
      default:
        console.warn(`Unknown agent type: ${this.options.agentType}`);
        return false;
    }
  }

  private async checkClaudeCompletion(): Promise<boolean> {
    try {
      // Claude stores project files in ~/.claude/projects/{encoded-path}/
      const homeDir = os.homedir();
      const encodedPath = this.options.workingDir.replace(/\//g, "-");
      const projectDir = path.join(homeDir, ".claude", "projects", encodedPath);

      // Check if project directory exists
      try {
        await fs.access(projectDir);
      } catch {
        console.log(`Claude project directory not found: ${projectDir}`);
        return false;
      }

      // Get the most recent JSONL file
      const files = await fs.readdir(projectDir);
      const jsonlFiles = files
        .filter((f) => f.endsWith(".jsonl"))
        .sort((a, b) => b.localeCompare(a)); // Sort by name (most recent first)

      if (jsonlFiles.length === 0) {
        console.log("No Claude project files found");
        return false;
      }

      // Check the most recent file
      const latestFile = path.join(projectDir, jsonlFiles[0]!);
      
      // If we're checking a different file, reset position
      if (latestFile !== this.lastCheckedFile) {
        this.lastCheckedFile = latestFile;
        this.lastCheckedPosition = 0;
      }

      // Read new lines from the file
      const content = await fs.readFile(latestFile, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());
      
      // Check only new lines since last check
      const newLines = lines.slice(this.lastCheckedPosition || 0);
      this.lastCheckedPosition = lines.length;

      // Check the last few messages for completion indicators
      for (let i = newLines.length - 1; i >= Math.max(0, newLines.length - 5); i--) {
        const line = newLines[i];
        if (!line) continue;
        try {
          const message = JSON.parse(line);
          
          // Check if this is an assistant message with stop_reason
          if (message.type === "assistant" && message.message) {
            const stopReason = message.message.stop_reason;
            
            // Claude Code is complete when stop_reason is "end_turn" or "stop_sequence"
            if (stopReason === "end_turn" || stopReason === "stop_sequence") {
              console.log(`Claude task complete: stop_reason = ${stopReason}`);
              return true;
            }
          }
          
          // Also check for error states that indicate completion
          if (message.error || message.message?.error) {
            console.log("Claude task complete: error encountered");
            return true;
          }
        } catch (e) {
          // Skip lines that aren't valid JSON
          continue;
        }
      }

      return false;
    } catch (error) {
      console.error(`Error checking Claude completion: ${error}`);
      return false;
    }
  }

  private async checkCodexCompletion(): Promise<boolean> {
    try {
      // Codex stores files in ~/.codex/
      const homeDir = os.homedir();
      const codexDir = path.join(homeDir, ".codex");

      // Check if codex directory exists
      try {
        await fs.access(codexDir);
      } catch {
        console.log(`Codex directory not found: ${codexDir}`);
        return false;
      }

      // TODO: Implement Codex-specific completion detection
      // For now, return false and we'll implement this case-by-case as requested
      console.log("Codex completion detection not yet implemented");
      return false;
    } catch (error) {
      console.error(`Error checking Codex completion: ${error}`);
      return false;
    }
  }

  private async checkGeminiCompletion(): Promise<boolean> {
    // TODO: Implement Gemini-specific completion detection
    console.log("Gemini completion detection not yet implemented");
    return false;
  }

  private async checkAmpCompletion(): Promise<boolean> {
    // TODO: Implement Amp-specific completion detection
    console.log("Amp completion detection not yet implemented");
    return false;
  }

  private async checkOpencodeCompletion(): Promise<boolean> {
    // TODO: Implement Opencode-specific completion detection
    console.log("Opencode completion detection not yet implemented");
    return false;
  }
}

// Fallback to terminal idle detection if project file detection fails
export async function detectTaskCompletionWithFallback(
  options: TaskCompletionOptions & {
    terminalId?: string;
    idleTimeoutMs?: number;
    onTerminalIdle?: () => void;
  }
): Promise<TaskCompletionDetector> {
  const detector = new TaskCompletionDetector(options);
  
  // Start the project file-based detection
  await detector.start();

  // If terminal ID is provided, also set up terminal idle detection as fallback
  if (options.terminalId && options.onTerminalIdle) {
    const { detectTerminalIdle } = await import("./detectTerminalIdle");
    
    detectTerminalIdle({
      sessionName: options.terminalId,
      idleTimeoutMs: options.idleTimeoutMs || 15000,
      onIdle: () => {
        console.log("Terminal idle detected (fallback)");
        detector.stop();
        options.onTerminalIdle!();
      },
    });
  }

  return detector;
}