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
  waitForString?: string;
  enterKeySequence?: string; // Custom enter key sequence, defaults to "\r"
}

export const AGENT_CONFIGS: AgentConfig[] = [
  {
    name: "claude-sonnet",
    command: "bunx",
    args: (prompt: string) => [
      "@anthropic-ai/claude-code",
      "--model",
      "claude-sonnet-4-20250514",
      "--dangerously-skip-permissions",
      prompt,
    ],
  },
  {
    name: "claude-opus",
    command: "bunx",
    args: (prompt: string) => [
      "@anthropic-ai/claude-code",
      "--model",
      "claude-opus-4-20250514",
      "--dangerously-skip-permissions",
      prompt,
    ],
  },
  {
    name: "codex-o3",
    command: "bunx",
    args: (prompt: string) => [
      "@openai/codex",
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
    args: (prompt: string) => [
      "opencode-ai@latest",
      "--model",
      "sonnet",
      "--prompt",
      prompt,
    ],
  },
  {
    name: "opencode-kimi-k2",
    command: "bunx",
    args: (prompt: string) => [
      "opencode-ai@latest",
      "--model",
      "kimi-k2",
      "--prompt",
      prompt,
    ],
  },
  {
    name: "gemini-2.5-flash",
    command: "bunx",
    args: (prompt: string) => [
      "@google/gemini-cli",
      "--model",
      "gemini-2.5-flash",
      "--yolo",
      "--prompt",
      prompt,
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
    args: (prompt: string) => [
      "@google/gemini-cli",
      "--model",
      "gemini-2.5-pro",
      "--yolo",
      "--prompt",
      prompt,
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
