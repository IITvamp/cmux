import type { AgentConfig } from "../../agentConfig.js";
import { ANTHROPIC_API_KEY } from "../../apiKeys.js";
import { checkClaudeRequirements } from "./check-requirements.js";
import { getClaudeEnvironment } from "./environment.js";

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
  apiKeys: [ANTHROPIC_API_KEY],
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
  apiKeys: [ANTHROPIC_API_KEY],
};
