import type { AgentConfig } from "../../agentConfig.js";
import { checkQwenRequirements } from "./check-requirements.js";
import { getQwenOpenAICompatibleEnvironment } from "./environment.js";
import { OPENROUTER_API_KEY } from "../../apiKeys.js";

// DashScope (intl) variant using provider-native model name
export const QWEN_OPENROUTER_CODER_FREE_CONFIG: AgentConfig = {
  name: "qwen/qwen3-coder:free",
  command: "pnpm",
  args: ["dlx", "@qwen-code/qwen-code", "--prompt-interactive", "$PROMPT"],
  environment: getQwenOpenAICompatibleEnvironment,
  // Use OpenRouter exclusively for Qwen Code authentication.
  // Inject as OPENAI_API_KEY (OpenAI-compatible clients expect this env var).
  apiKeys: [
    {
      ...OPENROUTER_API_KEY,
      mapToEnvVar: "OPENAI_API_KEY",
    },
  ],
  checkRequirements: checkQwenRequirements,
};
