import { getClaudeEnvironment } from "./environments/claude-environment.js";
import type { EnvironmentResult } from "./environments/environment-result.js";
import { getOpenAIEnvironment } from "./environments/openai-environment.js";

export { type EnvironmentResult };

export interface AgentConfig {
  name: string;
  command: string;
  args: string[];
  requiredApiKeys?: {
    envVar: string;
    displayName: string;
    description?: string;
  }[];
  environment?: () => Promise<EnvironmentResult>;
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
      "--ide",
      "$PROMPT",
    ],
    environment: getClaudeEnvironment,
  },
  {
    name: "claude-opus",
    command: "bunx",
    args: [
      "@anthropic-ai/claude-code",
      "--model",
      "claude-opus-4-20250514",
      "--dangerously-skip-permissions",
      "--ide",
      "$PROMPT",
    ],
    environment: getClaudeEnvironment,
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
    environment: getOpenAIEnvironment,
  },
  {
    name: "opencode-sonnet",
    command: "bunx",
    args: ["opencode-ai@latest", "--model", "sonnet", "--prompt", "$PROMPT"],
    environment: async () => {
      const { readFile } = await import("node:fs/promises");
      const { homedir } = await import("node:os");
      const { Buffer } = await import("node:buffer");
      const files: EnvironmentResult["files"] = [];

      try {
        const authContent = await readFile(
          `${homedir()}/.local/share/opencode/auth.json`,
          "utf-8"
        );
        files.push({
          destinationPath: "$HOME/.local/share/opencode/auth.json",
          contentBase64: Buffer.from(authContent).toString("base64"),
          mode: "600",
        });
      } catch (error) {
        console.warn("Failed to read opencode auth.json:", error);
      }

      return { files, env: {} };
    },
  },
  {
    name: "opencode-kimi-k2",
    command: "bunx",
    args: ["opencode-ai@latest", "--model", "kimi-k2", "--prompt", "$PROMPT"],
    environment: async () => {
      const { readFile } = await import("node:fs/promises");
      const { homedir } = await import("node:os");
      const { Buffer } = await import("node:buffer");
      const files: EnvironmentResult["files"] = [];

      try {
        const authContent = await readFile(
          `${homedir()}/.local/share/opencode/auth.json`,
          "utf-8"
        );
        files.push({
          destinationPath: "$HOME/.local/share/opencode/auth.json",
          contentBase64: Buffer.from(authContent).toString("base64"),
          mode: "600",
        });
      } catch (error) {
        console.warn("Failed to read opencode auth.json:", error);
      }

      return { files, env: {} };
    },
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
    environment: async () => {
      // For Gemini, we only need environment variables, no files
      return {
        files: [],
        env: {}, // Will be populated from Convex API keys in agentSpawner.ts
      };
    },
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
    environment: async () => {
      // For Gemini, we only need environment variables, no files
      return {
        files: [],
        env: {}, // Will be populated from Convex API keys in agentSpawner.ts
      };
    },
    requiredApiKeys: [
      {
        envVar: "GEMINI_API_KEY",
        displayName: "Gemini API Key",
        description: "API key for Google Gemini AI models",
      },
    ],
  },
];
