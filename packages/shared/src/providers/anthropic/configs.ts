import type { AgentConfig } from "../../agentConfig";
import { ANTHROPIC_API_KEY } from "../../apiKeys";
import { checkClaudeRequirements } from "./check-requirements";
import { startClaudeCompletionDetector } from "./completion-detector";
import { getClaudeEnvironment } from "./environment";

export const CLAUDE_SONNET_4_CONFIG: AgentConfig = {
  name: "claude/sonnet-4",
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
  checkRequirements: checkClaudeRequirements,
  apiKeys: [ANTHROPIC_API_KEY],
  applyApiKeys: async (keys) => {
    const key = keys[ANTHROPIC_API_KEY.envVar];
    if (!key) return {};
    const { Buffer } = await import("node:buffer");
    return {
      files: [
        {
          destinationPath: "$HOME/.claude/bin/.anthropic_key",
          contentBase64: Buffer.from(key).toString("base64"),
          mode: "600",
        },
      ],
      startupCommands: ["mkdir -p ~/.claude/bin"],
    };
  },
  completionDetector: startClaudeCompletionDetector,
};

export const CLAUDE_OPUS_4_CONFIG: AgentConfig = {
  name: "claude/opus-4",
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
  checkRequirements: checkClaudeRequirements,
  apiKeys: [ANTHROPIC_API_KEY],
  applyApiKeys: async (keys) => {
    const key = keys[ANTHROPIC_API_KEY.envVar];
    if (!key) return {};
    const { Buffer } = await import("node:buffer");
    return {
      files: [
        {
          destinationPath: "$HOME/.claude/bin/.anthropic_key",
          contentBase64: Buffer.from(key).toString("base64"),
          mode: "600",
        },
      ],
      startupCommands: ["mkdir -p ~/.claude/bin"],
    };
  },
  completionDetector: startClaudeCompletionDetector,
};

export const CLAUDE_OPUS_4_1_CONFIG: AgentConfig = {
  name: "claude/opus-4.1",
  command: "bunx",
  args: [
    "@anthropic-ai/claude-code",
    "--model",
    "claude-opus-4-1-20250805",
    "--dangerously-skip-permissions",
    "--ide",
    "$PROMPT",
  ],
  environment: getClaudeEnvironment,
  checkRequirements: checkClaudeRequirements,
  apiKeys: [ANTHROPIC_API_KEY],
  applyApiKeys: async (keys) => {
    const key = keys[ANTHROPIC_API_KEY.envVar];
    if (!key) return {};
    const { Buffer } = await import("node:buffer");
    return {
      files: [
        {
          destinationPath: "$HOME/.claude/bin/.anthropic_key",
          contentBase64: Buffer.from(key).toString("base64"),
          mode: "600",
        },
      ],
      startupCommands: ["mkdir -p ~/.claude/bin"],
    };
  },
  completionDetector: startClaudeCompletionDetector,
};

export const CLAUDE_SONNET_4_5_CONFIG: AgentConfig = {
  name: "claude/sonnet-4.5",
  command: "bunx",
  args: [
    "@anthropic-ai/claude-code",
    "--model",
    "claude-sonnet-4-5-20250929",
    "--dangerously-skip-permissions",
    "--ide",
    "$PROMPT",
  ],
  environment: getClaudeEnvironment,
  checkRequirements: checkClaudeRequirements,
  apiKeys: [ANTHROPIC_API_KEY],
  applyApiKeys: async (keys) => {
    const key = keys[ANTHROPIC_API_KEY.envVar];
    if (!key) return {};
    const { Buffer } = await import("node:buffer");
    return {
      files: [
        {
          destinationPath: "$HOME/.claude/bin/.anthropic_key",
          contentBase64: Buffer.from(key).toString("base64"),
          mode: "600",
        },
      ],
      startupCommands: ["mkdir -p ~/.claude/bin"],
    };
  },
  completionDetector: startClaudeCompletionDetector,
};
