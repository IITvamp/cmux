export interface AgentConfig {
  name: string;
  command: string;
  args: (prompt: string) => string[];
  env?: Record<string, string>;
  requiredApiKeys?: {
    envVar: string;
    displayName: string;
    description?: string;
  }[];
}

export const AGENT_CONFIGS: AgentConfig[] = [
  {
    name: "claude-sonnet",
    command: "claude",
    args: (prompt: string) => ["--dangerously-skip-permissions", prompt],
  },
  {
    name: "claude-opus",
    command: "claude",
    args: (prompt: string) => [
      "--dangerously-skip-permissions",
      "--model",
      "claude-opus-4-20250514",
      prompt,
    ],
  },
  {
    name: "codex-o3",
    command: "codex",
    args: (prompt: string) => [
      "--model",
      "o3",
      "--sandbox",
      "danger-full-access",
      "--ask-for-approval",
      "never",
      "--skip-git-repo-check",
      prompt,
    ],
  },
  {
    name: "opencode-sonnet",
    command: "bunx",
    args: (prompt: string) => ["opencode-ai", "--prompt", prompt],
  },
  {
    name: "gemini-2.5-flash",
    command: "bunx",
    args: (prompt: string) => [
      "@google/gemini-cli",
      "--model",
      "gemini-2.5-flash",
      "--yolo",
      // Using --prompt launches in non-interactive mode, which is not what we want
      // "--prompt",
      // prompt,
      // This part needs to be refactored. We need to wait until we receive the terminal output and check for "Type your message" and then send the prompt directly to stdin.
    ],
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
    args: (prompt: string) => [
      "@google/gemini-cli",
      "--model",
      "gemini-2.5-pro",
      "--yolo",
      "--prompt",
      prompt,
    ],
    requiredApiKeys: [
      {
        envVar: "GEMINI_API_KEY",
        displayName: "Gemini API Key",
        description: "API key for Google Gemini AI models",
      },
    ],
  },
];
