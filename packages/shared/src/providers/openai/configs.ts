import type { AgentConfig } from "../../agentConfig.js";
import { OPENAI_API_KEY } from "../../apiKeys.js";
import { checkOpenAIRequirements } from "./check-requirements.js";
import { getOpenAIEnvironment } from "./environment.js";

export const CODEX_GPT_5_CONFIG: AgentConfig = {
  name: "codex/gpt-5-2025-08-07",
  command: "bunx",
  args: [
    "@openai/codex",
    "--model",
    "gpt-5-2025-08-07",
    "--sandbox",
    "danger-full-access",
    "--ask-for-approval",
    "never",
    "--skip-git-repo-check",
    "$PROMPT",
  ],
  environment: getOpenAIEnvironment,
  checkRequirements: checkOpenAIRequirements,
  apiKeys: [OPENAI_API_KEY],
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
    "--skip-git-repo-check",
    "$PROMPT",
  ],
  environment: getOpenAIEnvironment,
  checkRequirements: checkOpenAIRequirements,
  apiKeys: [OPENAI_API_KEY],
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
    "--skip-git-repo-check",
    "$PROMPT",
  ],
  environment: getOpenAIEnvironment,
  checkRequirements: checkOpenAIRequirements,
  apiKeys: [OPENAI_API_KEY],
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
    "--skip-git-repo-check",
    "$PROMPT",
  ],
  environment: getOpenAIEnvironment,
  checkRequirements: checkOpenAIRequirements,
  apiKeys: [OPENAI_API_KEY],
};
