import type { AgentConfig } from "../../agentConfig.js";
import { GEMINI_API_KEY } from "../../apiKeys.js";
import { checkGeminiRequirements } from "./check-requirements.js";
// Lazy-load Node-only completion detector to avoid bundling fs in browser
import { getGeminiEnvironment } from "./environment.js";

export const GEMINI_FLASH_CONFIG: AgentConfig = {
  name: "gemini/2.5-flash",
  command: "bunx",
  args: [
    "@google/gemini-cli",
    "--model",
    "gemini-2.5-flash",
    "--yolo",
    "--telemetry",
    "--telemetry-target=local",
    "--telemetry-otlp-endpoint=",
    "--telemetry-outfile=/tmp/gemini-telemetry-$CMUX_TASK_RUN_ID.log",
    "--telemetry-log-prompts",
    "--prompt-interactive",
    "$PROMPT",
  ],
  environment: getGeminiEnvironment,
  apiKeys: [GEMINI_API_KEY],
  checkRequirements: checkGeminiRequirements,
  completionDetector: async (taskRunId, onComplete) => {
    const mod = await import("./completion-detector.js");
    mod.startGeminiCompletionDetector(taskRunId, onComplete);
  },
};

export const GEMINI_PRO_CONFIG: AgentConfig = {
  name: "gemini/2.5-pro",
  command: "bunx",
  args: [
    "@google/gemini-cli",
    "--model",
    "gemini-2.5-pro",
    "--yolo",
    "--telemetry",
    "--telemetry-target=local",
    "--telemetry-otlp-endpoint=",
    "--telemetry-outfile=/tmp/gemini-telemetry-$CMUX_TASK_RUN_ID.log",
    "--telemetry-log-prompts",
    "--prompt-interactive",
    "$PROMPT",
  ],
  environment: getGeminiEnvironment,
  apiKeys: [GEMINI_API_KEY],
  checkRequirements: checkGeminiRequirements,
  completionDetector: async (taskRunId, onComplete) => {
    const mod = await import("./completion-detector.js");
    mod.startGeminiCompletionDetector(taskRunId, onComplete);
  },
};
