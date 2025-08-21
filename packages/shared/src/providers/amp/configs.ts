import type { AgentConfig } from "../../agentConfig.js";
import { AMP_API_KEY } from "../../apiKeys.js";
import { checkAmpRequirements } from "./check-requirements.js";
import { getAmpEnvironment } from "./environment.js";

export const AMP_CONFIG: AgentConfig = {
  name: "amp",
  // Inline env assignment to keep agentSpawner provider-agnostic.
  // Uses CMUX_TASK_RUN_ID (spawner always sets this) as the fake key.
  command: "bash",
  args: [
    "-lc",
    // Default AMP_URL is set by environment() to http://localhost:39380, but keep a fallback here too.
    "AMP_API_KEY=\"$CMUX_TASK_RUN_ID\" AMP_URL=\"${AMP_URL:-http://localhost:39380}\" prompt-wrapper --prompt-env CMUX_PROMPT -- bunx @sourcegraph/amp@latest --dangerously-allow-all",
  ],
  environment: getAmpEnvironment,
  apiKeys: [AMP_API_KEY],
  checkRequirements: checkAmpRequirements,
};
