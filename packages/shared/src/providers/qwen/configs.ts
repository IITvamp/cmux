import type { AgentConfig } from "../../agentConfig.js";
import {
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
  OPENAI_MODEL,
} from "../../apiKeys.js";
import { checkQwenRequirements } from "./check-requirements.js";
import { getQwenOpenRouterEnvironment } from "./environment.js";

// DashScope (intl) variant using provider-native model name
export const QWEN_OPENROUTER_CODER_PLUS_CONFIG: AgentConfig = {
  name: "qwen/qwen3-coder-plus",
  command: "pnpm",
  args: ["dlx", "@qwen-code/qwen-code", "--prompt-interactive", "$PROMPT"],
  environment: getQwenOpenRouterEnvironment,
  apiKeys: [OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL],
  checkRequirements: checkQwenRequirements,
};
