import type { AgentConfig } from "../../agentConfig.js";
import { checkGeminiRequirements } from "./check-requirements.js";
import { getGeminiEnvironment } from "./environment.js";

export const GEMINI_FLASH_CONFIG: AgentConfig = {
  name: "gemini-2.5-flash",
  command: "bunx",
  args: [
    "@google/gemini-cli",
    "--model",
    "gemini-2.5-flash",
    "--yolo",
    "--prompt-interactive",
    "$PROMPT",
  ],
  environment: getGeminiEnvironment,
  apiKeys: [
    {
      envVar: "GEMINI_API_KEY",
      displayName: "Gemini API Key",
      description: "API key for Google Gemini AI models",
    },
  ],
  checkRequirements: checkGeminiRequirements,
};

export const GEMINI_PRO_CONFIG: AgentConfig = {
  name: "gemini-2.5-pro",
  command: "bunx",
  args: [
    "@google/gemini-cli",
    "--model",
    "gemini-2.5-pro",
    "--yolo",
    "--prompt-interactive",
    "$PROMPT",
  ],
  environment: getGeminiEnvironment,
  apiKeys: [
    {
      envVar: "GEMINI_API_KEY",
      displayName: "Gemini API Key",
      description: "API key for Google Gemini AI models",
    },
  ],
  checkRequirements: checkGeminiRequirements,
};