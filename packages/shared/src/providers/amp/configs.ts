import type { AgentConfig } from "../../agentConfig.js";
import { AMP_API_KEY } from "../../apiKeys.js";
import { checkAmpRequirements } from "./check-requirements.js";
import { getAmpEnvironment } from "./environment.js";

export const AMP_CONFIG: AgentConfig = {
  name: "amp",
  command: "prompt-wrapper",
  args: [
    "--prompt-env",
    "CMUX_PROMPT",
    "--",
    "bunx",
    "@sourcegraph/amp@latest",
    "--dangerously-allow-all",
  ],
  environment: getAmpEnvironment,
  apiKeys: [AMP_API_KEY],
  checkRequirements: checkAmpRequirements,
};
