import type { AgentConfig } from "../../agentConfig.js";
import { checkOpencodeRequirements } from "./check-requirements.js";
import { getOpencodeEnvironment } from "./environment.js";

export const OPENCODE_SONNET_CONFIG: AgentConfig = {
  name: "opencode-sonnet",
  command: "bunx",
  args: ["opencode-ai@latest", "--model", "sonnet", "--prompt", "$PROMPT"],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
};

export const OPENCODE_KIMI_K2_CONFIG: AgentConfig = {
  name: "opencode-kimi-k2",
  command: "bunx",
  args: ["opencode-ai@latest", "--model", "kimi-k2", "--prompt", "$PROMPT"],
  environment: getOpencodeEnvironment,
  checkRequirements: checkOpencodeRequirements,
};