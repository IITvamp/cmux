import type { AgentConfig } from "../../agentConfig.js";
import {
  checkQwenOpenRouterRequirements,
  checkQwenModelStudioRequirements,
} from "./check-requirements.js";
import {
  getQwenOpenRouterEnvironment,
  getQwenModelStudioEnvironment,
} from "./environment.js";
import { MODEL_STUDIO_API_KEY, OPENROUTER_API_KEY } from "../../apiKeys.js";

export const QWEN_OPENROUTER_CODER_FREE_CONFIG: AgentConfig = {
  name: "qwen/qwen3-coder:free",
  command: "pnpm",
  args: ["dlx", "@qwen-code/qwen-code", "--prompt-interactive", "$PROMPT"],
  environment: getQwenOpenRouterEnvironment,
  // Use OpenRouter exclusively for Qwen Code authentication.
  // Inject as OPENAI_API_KEY (OpenAI-compatible clients expect this env var).
  apiKeys: [
    {
      ...OPENROUTER_API_KEY,
      mapToEnvVar: "OPENAI_API_KEY",
    },
  ],
  checkRequirements: checkQwenOpenRouterRequirements,
};

export const QWEN_MODEL_STUDIO_CODER_PLUS_CONFIG: AgentConfig = {
  name: "qwen/qwen3-coder-plus",
  command: "pnpm",
  args: ["dlx", "@qwen-code/qwen-code", "--prompt-interactive", "$PROMPT"],
  environment: getQwenModelStudioEnvironment,
  // Accept a ModelStudio-specific key in Settings and inject as OPENAI_API_KEY
  // for the OpenAI-compatible client.
  apiKeys: [
    {
      ...MODEL_STUDIO_API_KEY,
      mapToEnvVar: "OPENAI_API_KEY",
    },
  ],
  checkRequirements: checkQwenModelStudioRequirements,
};
