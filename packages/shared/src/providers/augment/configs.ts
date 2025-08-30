import type { AgentConfig } from "../../agentConfig.js";
import { AUGMENT_API_KEY } from "../../apiKeys.js";
import { checkAugmentRequirements } from "./check-requirements.js";
import { getAugmentEnvironment } from "./environment.js";

export const AUGMENT_GPT_5_CONFIG: AgentConfig = {
  name: "augment/gpt-5",
  command: "auggie",
  args: ["--model", "gpt5", "$PROMPT"],
  environment: getAugmentEnvironment,
  checkRequirements: checkAugmentRequirements,
  apiKeys: [AUGMENT_API_KEY],
  waitForString: "Ready",
};

export const AUGMENT_CLAUDE_SONNET_4_CONFIG: AgentConfig = {
  name: "augment/claude-sonnet-4",
  command: "auggie",
  args: ["--model", "sonnet4", "$PROMPT"],
  environment: getAugmentEnvironment,
  checkRequirements: checkAugmentRequirements,
  apiKeys: [AUGMENT_API_KEY],
  waitForString: "Ready",
};
