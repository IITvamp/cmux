import type { AgentConfig } from "../../agentConfig.js";
import { checkAugmentRequirements } from "./check-requirements.js";
import { getAugmentEnvironment } from "./environment.js";

// Augment (Auggie) agents
// Model IDs provided by user: gpt5 and sonnet4

export const AUGMENT_GPT_5_CONFIG: AgentConfig = {
  name: "augment/gpt-5",
  command: "auggie",
  args: ["--model", "gpt5", "$PROMPT"],
  environment: getAugmentEnvironment,
  checkRequirements: checkAugmentRequirements,
};

export const AUGMENT_SONNET_4_CONFIG: AgentConfig = {
  name: "augment/claude-sonnet-4",
  command: "auggie",
  args: ["--model", "sonnet4", "$PROMPT"],
  environment: getAugmentEnvironment,
  checkRequirements: checkAugmentRequirements,
};

