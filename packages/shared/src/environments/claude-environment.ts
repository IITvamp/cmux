import type { EnvironmentResult } from "./environment-result.js";

export async function getClaudeEnvironment(): Promise<EnvironmentResult> {
  // These must be lazy since configs are imported into the browser
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { readFile } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
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

  return { files, env, startupCommands };
}
