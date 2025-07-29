import type { AgentConfig, AgentConfigApiKeys } from "../../agentConfig.js";
import { checkClaudeRequirements } from "./check-requirements.js";
import { getClaudeEnvironment } from "./environment.js";

const apiKeys: AgentConfigApiKeys = [
  {
    envVar: "ANTHROPIC_API_KEY",
    displayName: "Anthropic API Key",
    description: "Anthropic API Key",
  },
];

export const CLAUDE_SONNET_CONFIG: AgentConfig = {
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
  apiKeys,
};

export const CLAUDE_OPUS_CONFIG: AgentConfig = {
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
  apiKeys,
};
