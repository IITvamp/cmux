import type { AgentConfig } from "../../agentConfig.js";
import { OPENROUTER_API_KEY } from "../../apiKeys.js";
import { checkQwenRequirements } from "./check-requirements.js";
import { getQwenEnvironment } from "./environment.js";

// Qwen Code CLI (adapted from Gemini CLI) supports --model and --prompt-interactive.
// We surface a couple of sensible model presets. Users can still switch in-CLI.

export const QWEN_CODER_PLUS_CONFIG: AgentConfig = {
  name: "qwen/qwen3-coder-plus",
  command: "bunx",
  args: [
    "@qwen-code/qwen-code",
    "--model",
    "qwen3-coder-plus",
    "--yolo",
    "--telemetry",
    "--telemetry-target=local",
    "--telemetry-otlp-endpoint=",
    "--telemetry-outfile=/tmp/qwen-telemetry-$CMUX_TASK_RUN_ID.log",
    "--telemetry-log-prompts",
    "--prompt-interactive",
    "$PROMPT",
  ],
  environment: getQwenEnvironment,
  checkRequirements: checkQwenRequirements,
};

export const QWEN_CODER_FREE_OPENROUTER_CONFIG: AgentConfig = {
  name: "qwen/qwen3-coder-free",
  command: "bunx",
  args: [
    "@qwen-code/qwen-code",
    "--model",
    // OpenRouter free tier slug per Qwen docs
    "qwen/qwen3-coder:free",
    "--yolo",
    "--telemetry",
    "--telemetry-target=local",
    "--telemetry-otlp-endpoint=",
    "--telemetry-outfile=/tmp/qwen-telemetry-$CMUX_TASK_RUN_ID.log",
    "--telemetry-log-prompts",
    "--prompt-interactive",
    "$PROMPT",
  ],
  environment: getQwenEnvironment,
  checkRequirements: checkQwenRequirements,
  apiKeys: [OPENROUTER_API_KEY],
};
