import type { AgentConfig } from "../../agentConfig.js";
import {
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  OPENROUTER_API_KEY,
} from "../../apiKeys.js";
import { checkOpencodeRequirements } from "./check-requirements.js";
import { getOpencodeEnvironment } from "./environment.js";

export const OPENCODE_GROK_CODE_CONFIG: AgentConfig = {
  name: "opencode/grok-code",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "openrouter/x-ai/grok-code-fast-1",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
  apiKeys: [OPENROUTER_API_KEY],
};

export const OPENCODE_SONNET_CONFIG: AgentConfig = {
  name: "opencode/sonnet-4",
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
  apiKeys: [ANTHROPIC_API_KEY],
};

export const OPENCODE_OPUS_CONFIG: AgentConfig = {
  name: "opencode/opus-4",
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
  apiKeys: [ANTHROPIC_API_KEY],
};

export const OPENCODE_KIMI_K2_CONFIG: AgentConfig = {
  name: "opencode/kimi-k2",
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
  apiKeys: [OPENROUTER_API_KEY],
};

export const OPENCODE_QWEN3_CODER_CONFIG: AgentConfig = {
  name: "opencode/qwen3-coder",
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
  apiKeys: [ANTHROPIC_API_KEY],
};

export const OPENCODE_GLM_Z1_32B_FREE_CONFIG: AgentConfig = {
  name: "opencode/glm-4.5",
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
  apiKeys: [OPENROUTER_API_KEY],
};

export const OPENCODE_O3_PRO_CONFIG: AgentConfig = {
  name: "opencode/o3-pro",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "openai/o3-pro",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
  apiKeys: [OPENAI_API_KEY],
};

export const OPENCODE_GPT_5_CONFIG: AgentConfig = {
  name: "opencode/gpt-5",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "openai/gpt-5",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
  apiKeys: [OPENAI_API_KEY],
};

export const OPENCODE_GPT_5_MINI_CONFIG: AgentConfig = {
  name: "opencode/gpt-5-mini",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "openai/gpt-5-mini",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
  apiKeys: [OPENAI_API_KEY],
};

export const OPENCODE_GPT_5_NANO_CONFIG: AgentConfig = {
  name: "opencode/gpt-5-nano",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "openai/gpt-5-nano",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
  apiKeys: [OPENAI_API_KEY],
};

export const OPENCODE_GPT_OSS_120B_CONFIG: AgentConfig = {
  name: "opencode/gpt-oss-120b",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "openrouter/openai/gpt-oss-120b",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
  apiKeys: [OPENROUTER_API_KEY],
};

export const OPENCODE_GPT_OSS_20B_CONFIG: AgentConfig = {
  name: "opencode/gpt-oss-20b",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "openrouter/openai/gpt-oss-20b",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
  apiKeys: [OPENROUTER_API_KEY],
};

export const OPENCODE_OPUS_4_1_20250805_CONFIG: AgentConfig = {
  name: "opencode/opus-4.1-20250805",
  command: "bunx",
  args: [
    "opencode-ai@latest",
    "--prompt",
    "$PROMPT",
    "--model",
    "anthropic/claude-opus-4-1-20250805",
  ],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
  apiKeys: [ANTHROPIC_API_KEY],
};
