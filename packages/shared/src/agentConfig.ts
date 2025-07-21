export interface AuthFileConfig {
  source: string; // Path on host, can include $HOME
  destination: string; // Path in container/remote
  platform?: "darwin" | "linux" | "win32"; // Optional platform-specific config
  transform?: (content: string) => Promise<string>; // Optional transform function to apply to the content
}

export interface AgentConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  requiredApiKeys?: {
    envVar: string;
    displayName: string;
    description?: string;
  }[];
  authFiles?: AuthFileConfig[]; // Files to copy for authentication
  waitForString?: string;
  enterKeySequence?: string; // Custom enter key sequence, defaults to "\r"
}

export const AGENT_CONFIGS: AgentConfig[] = [
  {
    name: "claude-sonnet",
    command: "bunx",
    args: [
      "@anthropic-ai/claude-code",
      "--model",
      "claude-sonnet-4-20250514",
      "--dangerously-skip-permissions",
      "$PROMPT",
    ],
    authFiles: [
      {
        source: "$HOME/.claude.json",
        destination: "$HOME/.claude.json",
        transform: async (content) => {
          const parsed = JSON.parse(content) as {
            projects: Record<string, unknown>;
          };
          // parsed["projects"] = parsed["projects"] || {};
          parsed["projects"] = {};
          parsed["projects"]["/root/workspace"] = {
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
          };
          return JSON.stringify(parsed, null, 2);
        },
      },
      {
        source: "/dev/null",
        destination: "$HOME/.claude/.credentials.json",
        transform: async () => {
          const { exec } = await import("node:child_process");
          const { promisify } = await import("node:util");
          const execAsync = promisify(exec);
          try {
            const execResult = await execAsync(
              "security find-generic-password -a $USER -w -s 'Claude Code-credentials'"
            );
            const { stdout } = execResult;
            const credentialsText = stdout.trim();

            // Validate that it's valid JSON
            let credentials;
            try {
              credentials = JSON.parse(credentialsText);
            } catch (parseError) {
              throw new Error(
                `Invalid JSON in keychain credentials: ${parseError}`
              );
            }

            // Check that it has claudeAiOauth field
            if (!credentials.claudeAiOauth) {
              throw new Error(
                "Missing 'claudeAiOauth' field in keychain credentials"
              );
            }

            return credentialsText;
          } catch (error) {
            // fallback to "Claude Code", which is just a raw api key. So we need to wrap in { "claudeAiOauth": {"accessToken": "..."} }
            const execResult = await execAsync(
              "security find-generic-password -a $USER -w -s 'Claude Code'"
            );
            const { stdout } = execResult;
            const credentialsText = stdout.trim();
            // Check it's greater than 50 characters
            if (credentialsText.length < 50) {
              throw new Error(
                `Failed to retrieve credentials from keychain: ${error}`
              );
            }
            return JSON.stringify({
              claudeAiOauth: {
                accessToken: credentialsText,
              },
            });
          }
        },
      },
    ],
  },
  {
    name: "claude-opus",
    command: "bunx",
    args: [
      "@anthropic-ai/claude-code",
      "--model",
      "claude-opus-4-20250514",
      "--dangerously-skip-permissions",
      "$PROMPT",
    ],
    authFiles: [
      {
        source: "$HOME/.claude.json",
        destination: "$HOME/.claude.json",
      },
    ],
  },
  {
    name: "codex-o3",
    command: "bunx",
    args: [
      "@openai/codex",
      "--model",
      "o3",
      "--sandbox",
      "danger-full-access",
      "--ask-for-approval",
      "never",
      "--skip-git-repo-check",
      "$PROMPT",
    ],
    authFiles: [
      {
        source: "$HOME/.codex/auth.json",
        destination: "$HOME/.codex/auth.json",
      },
      {
        source: "$HOME/.codex/config.json",
        destination: "$HOME/.codex/config.json",
      },
    ],
  },
  {
    name: "opencode-sonnet",
    command: "bunx",
    args: ["opencode-ai@latest", "--model", "sonnet", "--prompt", "$PROMPT"],
    authFiles: [
      {
        source: "$HOME/.local/share/opencode/auth.json",
        destination: "$HOME/.local/share/opencode/auth.json",
        platform: "darwin",
      },
      {
        source: "$HOME/.local/share/opencode/auth.json",
        destination: "$HOME/.local/share/opencode/auth.json",
        platform: "linux",
      },
    ],
  },
  {
    name: "opencode-kimi-k2",
    command: "bunx",
    args: ["opencode-ai@latest", "--model", "kimi-k2", "--prompt", "$PROMPT"],
    authFiles: [
      {
        source: "$HOME/.local/share/opencode/auth.json",
        destination: "$HOME/.local/share/opencode/auth.json",
        platform: "darwin",
      },
      {
        source: "$HOME/.local/share/opencode/auth.json",
        destination: "$HOME/.local/share/opencode/auth.json",
        platform: "linux",
      },
    ],
  },
  {
    name: "gemini-2.5-flash",
    command: "bunx",
    args: [
      "@google/gemini-cli",
      "--model",
      "gemini-2.5-flash",
      "--yolo",
      "--prompt",
      "$PROMPT",
    ],
    // waitForString: "Type your message",
    requiredApiKeys: [
      {
        envVar: "GEMINI_API_KEY",
        displayName: "Gemini API Key",
        description: "API key for Google Gemini AI models",
      },
    ],
  },
  {
    name: "gemini-2.5-pro",
    command: "bunx",
    args: [
      "@google/gemini-cli",
      "--model",
      "gemini-2.5-pro",
      "--yolo",
      "--prompt",
      "$PROMPT",
    ],
    // waitForString: "Type your message",
    requiredApiKeys: [
      {
        envVar: "GEMINI_API_KEY",
        displayName: "Gemini API Key",
        description: "API key for Google Gemini AI models",
      },
    ],
  },
];
