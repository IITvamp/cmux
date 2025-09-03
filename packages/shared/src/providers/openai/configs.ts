import type { AgentConfig } from "../../agentConfig.js";
import { OPENAI_API_KEY, OPENROUTER_API_KEY } from "../../apiKeys.js";
import { checkOpenAIRequirements } from "./check-requirements.js";
// Lazy-load Node-only completion detector to avoid bundling fs in browser
import { getOpenAIEnvironment } from "./environment.js";
import { startCodexCompletionDetector } from "./completion-detector.js";
import type { EnvironmentContext, EnvironmentResult } from "../common/environment-result.js";

// Minimal requirement check for OpenRouter-backed Codex configs
export async function checkOpenRouterRequirements(): Promise<string[]> {
  const missing: string[] = [];
  if (!process.env.OPENROUTER_API_KEY) {
    missing.push("OPENROUTER_API_KEY is not set");
  }
  return missing;
}

async function getCodexOpenRouterEnvironment(
  ctx: EnvironmentContext,
  opts: { baseUrl: string }
): Promise<EnvironmentResult> {
  const base = await getOpenAIEnvironment(ctx);
  return {
    files: base.files,
    startupCommands: base.startupCommands,
    env: {
      ...base.env,
      OPENAI_BASE_URL: opts.baseUrl,
    },
  };
}

export const CODEX_GPT_5_CONFIG: AgentConfig = {
  name: "codex/gpt-5",
  command: "bunx",
  args: [
    "@openai/codex",
    "--model",
    "gpt-5",
    "--sandbox",
    "danger-full-access",
    "--ask-for-approval",
    "never",
    "$PROMPT",
  ],
  environment: getOpenAIEnvironment,
  checkRequirements: checkOpenAIRequirements,
  apiKeys: [OPENAI_API_KEY],
  completionDetector: startCodexCompletionDetector,
};

export const CODEX_GPT_5_HIGH_REASONING_CONFIG: AgentConfig = {
  name: "codex/gpt-5-high",
  command: "bunx",
  args: [
    "@openai/codex",
    "--model",
    "gpt-5",
    "--sandbox",
    "danger-full-access",
    "--ask-for-approval",
    "never",
    "-c",
    'model_reasoning_effort="high"',
    "$PROMPT",
  ],
  environment: getOpenAIEnvironment,
  checkRequirements: checkOpenAIRequirements,
  apiKeys: [OPENAI_API_KEY],
  completionDetector: startCodexCompletionDetector,
};

export const CODEX_O3_CONFIG: AgentConfig = {
  name: "codex/o3",
  command: "bunx",
  args: [
    "@openai/codex",
    "--model",
    "o3",
    "--sandbox",
    "danger-full-access",
    "--ask-for-approval",
    "never",
    "$PROMPT",
  ],
  environment: getOpenAIEnvironment,
  checkRequirements: checkOpenAIRequirements,
  apiKeys: [OPENAI_API_KEY],
  completionDetector: startCodexCompletionDetector,
};

export const CODEX_O4_MINI_CONFIG: AgentConfig = {
  name: "codex/o4-mini",
  command: "bunx",
  args: [
    "@openai/codex",
    "--model",
    "o4-mini",
    "--sandbox",
    "danger-full-access",
    "--ask-for-approval",
    "never",
    "$PROMPT",
  ],
  environment: getOpenAIEnvironment,
  checkRequirements: checkOpenAIRequirements,
  apiKeys: [OPENAI_API_KEY],
  completionDetector: startCodexCompletionDetector,
};

export const CODEX_GPT_4_1_CONFIG: AgentConfig = {
  name: "codex/gpt-4.1",
  command: "bunx",
  args: [
    "@openai/codex",
    "--model",
    "gpt-4.1",
    "--sandbox",
    "danger-full-access",
    "--ask-for-approval",
    "never",
    "$PROMPT",
  ],
  environment: getOpenAIEnvironment,
  checkRequirements: checkOpenAIRequirements,
  apiKeys: [OPENAI_API_KEY],
  completionDetector: startCodexCompletionDetector,
};

// OpenRouter-backed Grok Code (x-ai/grok-code-fast-1) via Codex CLI
export const CODEX_GROK_CODE_FAST_1_CONFIG: AgentConfig = {
  name: "codex/grok-code-fast-1",
  command: "bunx",
  args: [
    "@openai/codex",
    "--model",
    "x-ai/grok-code-fast-1",
    "--sandbox",
    "danger-full-access",
    "--ask-for-approval",
    "never",
    "$PROMPT",
  ],
  // Point Codex at OpenRouter’s OpenAI-compatible endpoint
  environment: (ctx) =>
    getCodexOpenRouterEnvironment(ctx, {
      baseUrl: "https://openrouter.ai/api/v1",
    }),
  // Use the OpenRouter key, injected as OPENAI_API_KEY for OpenAI-compatible clients
  apiKeys: [
    {
      ...OPENROUTER_API_KEY,
      mapToEnvVar: "OPENAI_API_KEY",
    },
  ],
  checkRequirements: checkOpenRouterRequirements,
  completionDetector: startCodexCompletionDetector,
};
