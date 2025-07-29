import type { AgentConfig } from "../../agentConfig.js";
import { checkAmpRequirements } from "./check-requirements.js";
import { getAmpEnvironment } from "./environment.js";

export const AMP_CONFIG: AgentConfig = {
  name: "amp",
  command: "prompt-wrapper",
  args: [
    "--prompt",
    "$PROMPT",
    "--",
    "bunx",
    "@sourcegraph/amp@latest",
    "--dangerously-allow-all",
  ],
  environment: getAmpEnvironment,
  apiKeys: [
    {
      envVar: "AMP_API_KEY",
      displayName: "AMP API Key",
      description: "API key for Sourcegraph AMP",
    },
  ],
  checkRequirements: checkAmpRequirements,
};
