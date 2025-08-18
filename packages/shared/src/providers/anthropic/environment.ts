import type { EnvironmentResult } from "../common/environment-result.js";

export async function getClaudeEnvironment(): Promise<EnvironmentResult> {
  // These must be lazy since configs are imported into the browser
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { readFile } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { Buffer } = await import("node:buffer");
  const execAsync = promisify(exec);

  const files: EnvironmentResult["files"] = [];
  const env: Record<string, string> = {};
  const startupCommands: string[] = [];

  // Prepare .claude.json
  try {
    // Try to read existing .claude.json, or create a new one
    let existingConfig = {};
    try {
      const content = await readFile(`${homedir()}/.claude.json`, "utf-8");
      existingConfig = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid, start fresh
    }

    const config = {
      ...existingConfig,
      projects: {
        "/root/workspace": {
          allowedTools: [],
          history: [],
          mcpContextUris: [],
          mcpServers: {},
          enabledMcpjsonServers: [],
          disabledMcpjsonServers: [],
          hasTrustDialogAccepted: true,
          projectOnboardingSeenCount: 0,
          hasClaudeMdExternalIncludesApproved: false,
          hasClaudeMdExternalIncludesWarningShown: false,
        },
      },
      isQualifiedForDataSharing: false,
      hasCompletedOnboarding: true,
      bypassPermissionsModeAccepted: true,
      hasAcknowledgedCostThreshold: true,
    };

    files.push({
      destinationPath: "$HOME/.claude.json",
      contentBase64: Buffer.from(JSON.stringify(config, null, 2)).toString(
        "base64"
      ),
      mode: "644",
    });
  } catch (error) {
    console.warn("Failed to prepare .claude.json:", error);
  }

  // Try to get credentials and prepare .credentials.json
  let credentialsAdded = false;
  try {
    // First try Claude Code-credentials (preferred)
    const execResult = await execAsync(
      "security find-generic-password -a $USER -w -s 'Claude Code-credentials'"
    );
    const credentialsText = execResult.stdout.trim();

    // Validate that it's valid JSON with claudeAiOauth
    const credentials = JSON.parse(credentialsText);
    if (credentials.claudeAiOauth) {
      files.push({
        destinationPath: "$HOME/.claude/.credentials.json",
        contentBase64: Buffer.from(credentialsText).toString("base64"),
        mode: "600",
      });
      credentialsAdded = true;
    }
  } catch {
    // noop
  }

  // If no credentials file was created, try to use API key as environment variable
  if (!credentialsAdded) {
    try {
      const execResult = await execAsync(
        "security find-generic-password -a $USER -w -s 'Claude Code'"
      );
      const apiKey = execResult.stdout.trim();
      env.ANTHROPIC_API_KEY = apiKey;

      // Add startup command to persist the API key in .bashrc
      startupCommands.push(
        `grep -q "export ANTHROPIC_API_KEY=" ~/.bashrc || echo 'export ANTHROPIC_API_KEY="${apiKey}"' >> ~/.bashrc`
      );
    } catch {
      console.warn("No Claude API key found in keychain");
    }
  }

  // Ensure .claude directory exists
  startupCommands.unshift("mkdir -p ~/.claude");
  
  // Create the stop hook script and settings.json in the project directory via startup commands
  // This ensures they're created AFTER the workspace exists
  const stopHookScript = `#!/bin/bash
# Claude Code stop hook for cmux task completion detection
# This script is called when Claude Code finishes responding

# Log to multiple places for debugging
LOG_FILE="/tmp/cmux/claude-hook.log"
mkdir -p /tmp/cmux

echo "[CMUX Stop Hook] Script started at $(date)" >> "$LOG_FILE"
echo "[CMUX Stop Hook] CMUX_TASK_ID=\${CMUX_TASK_ID}" >> "$LOG_FILE"
echo "[CMUX Stop Hook] PWD=$(pwd)" >> "$LOG_FILE"
echo "[CMUX Stop Hook] All env vars:" >> "$LOG_FILE"
env | grep -E "(CMUX|CLAUDE|TASK)" >> "$LOG_FILE" 2>&1

# Create a completion marker file that cmux can detect
COMPLETION_MARKER="/tmp/cmux/claude-complete-\${CMUX_TASK_ID:-unknown}"
echo "$(date +%s)" > "$COMPLETION_MARKER"

# Log success
echo "[CMUX Stop Hook] Created marker file: $COMPLETION_MARKER" >> "$LOG_FILE"
ls -la "$COMPLETION_MARKER" >> "$LOG_FILE" 2>&1

# Also log to stderr for visibility
echo "[CMUX Stop Hook] Task completed for task ID: \${CMUX_TASK_ID:-unknown}" >&2
echo "[CMUX Stop Hook] Created marker file: $COMPLETION_MARKER" >&2

# Always allow Claude to stop (don't block)
exit 0`;

  // Add startup commands to create hook files in project directory
  startupCommands.push("mkdir -p /root/workspace/.claude");
  
  // Create the stop hook script
  startupCommands.push(`cat > /root/workspace/.claude/stop-hook.sh << 'EOF'
${stopHookScript}
EOF`);
  startupCommands.push("chmod +x /root/workspace/.claude/stop-hook.sh");
  
  // Create settings.json with hooks configuration
  const settingsConfig = {
    hooks: {
      Stop: [
        {
          hooks: [
            {
              type: "command",
              command: "/root/workspace/.claude/stop-hook.sh"
            }
          ]
        }
      ]
    }
  };
  
  startupCommands.push(`cat > /root/workspace/.claude/settings.json << 'EOF'
${JSON.stringify(settingsConfig, null, 2)}
EOF`);
  
  // Log the files for debugging
  startupCommands.push("echo '[CMUX] Created Claude hook files:' && ls -la /root/workspace/.claude/");
  startupCommands.push("echo '[CMUX] Settings content:' && cat /root/workspace/.claude/settings.json");

  return { files, env, startupCommands };
}
