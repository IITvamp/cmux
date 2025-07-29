import type { EnvironmentResult } from "./environments/environment-result.js";

import { AMP_CONFIG } from "./providers/amp/configs.js";
import {
  CLAUDE_OPUS_CONFIG,
  CLAUDE_SONNET_CONFIG,
} from "./providers/claude/configs.js";
import {
  GEMINI_FLASH_CONFIG,
  GEMINI_PRO_CONFIG,
} from "./providers/gemini/configs.js";
import {
  CODEX_O3_CONFIG,
  CODEX_O4_MINI_CONFIG,
  CODEX_GPT_4_1_CONFIG,
} from "./providers/openai/configs.js";
import {
  OPENCODE_GLM_Z1_32B_FREE_CONFIG,
  OPENCODE_KIMI_K2_CONFIG,
  OPENCODE_OPUS_CONFIG,
  OPENCODE_QWEN3_CODER_CONFIG,
  OPENCODE_SONNET_CONFIG,
} from "./providers/opencode/configs.js";

export { checkDockerStatus } from "./providers/common/check-docker.js";
export { checkGitStatus } from "./providers/common/check-git.js";

export { type EnvironmentResult };

export interface AgentConfig {
  name: string;
  command: string;
  args: string[];
  apiKeys?: {
    envVar: string;
    displayName: string;
    description?: string;
  }[];
  environment?: () => Promise<EnvironmentResult>;
  waitForString?: string;
  enterKeySequence?: string; // Custom enter key sequence, defaults to "\r"
  checkRequirements?: () => Promise<string[]>; // Returns list of missing requirements
}

export const AGENT_CONFIGS: AgentConfig[] = [
  CLAUDE_SONNET_CONFIG,
  CLAUDE_OPUS_CONFIG,
  CODEX_O3_CONFIG,
  CODEX_O4_MINI_CONFIG,
  CODEX_GPT_4_1_CONFIG,
  OPENCODE_SONNET_CONFIG,
  OPENCODE_OPUS_CONFIG,
  OPENCODE_KIMI_K2_CONFIG,
  OPENCODE_QWEN3_CODER_CONFIG,
  OPENCODE_GLM_Z1_32B_FREE_CONFIG,
  GEMINI_FLASH_CONFIG,
  GEMINI_PRO_CONFIG,
  AMP_CONFIG,
];
