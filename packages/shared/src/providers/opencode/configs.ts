import type { AgentConfig } from "../../agentConfig.js";
import { checkOpencodeRequirements } from "./check-requirements.js";
import { getOpencodeEnvironment } from "./environment.js";

export const OPENCODE_SONNET_CONFIG: AgentConfig = {
  name: "opencode-sonnet",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "anthropic/claude-sonnet-4-20250514",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
};

export const OPENCODE_OPUS_CONFIG: AgentConfig = {
  name: "opencode-opus",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "anthropic/claude-opus-4-20250514",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
};

export const OPENCODE_KIMI_K2_CONFIG: AgentConfig = {
  name: "opencode-kimi-k2",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "openrouter/moonshotai/kimi-k2",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
};

export const OPENCODE_QWEN3_CODER_CONFIG: AgentConfig = {
  name: "opencode-qwen3-coder",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "openrouter/qwen/qwen3-coder",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
};

export const OPENCODE_GLM_Z1_32B_FREE_CONFIG: AgentConfig = {
  name: "opencode-z-ai/glm-4.5",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "openrouter/z-ai/glm-4.5",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
};
