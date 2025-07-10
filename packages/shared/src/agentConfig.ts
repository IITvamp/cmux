export interface AgentConfig {
  name: string;
  command: string;
  args: (prompt: string) => string[];
  env?: Record<string, string>;
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
      "--prompt",
      prompt,
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
  },
];
