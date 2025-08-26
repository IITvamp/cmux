import type { AgentConfig } from "../../agentConfig.js";
import { CURSOR_API_KEY } from "../../apiKeys.js";
import { checkCursorRequirements } from "./check-requirements.js";
import { getCursorEnvironment } from "./environment.js";

export const CURSOR_OPUS_4_1_CONFIG: AgentConfig = {
  name: "cursor/opus-4.1",
  command: "/root/.local/bin/cursor-agent",
  args: ["--force", "--model", "opus-4.1", "--output-format", "$PROMPT"],
  environment: getCursorEnvironment,
  checkRequirements: checkCursorRequirements,
  apiKeys: [CURSOR_API_KEY],
  waitForString: "Ready",
};

export const CURSOR_GPT_5_CONFIG: AgentConfig = {
  name: "cursor/gpt-5",
  command: "/root/.local/bin/cursor-agent",
  args: ["--force", "--model", "gpt-5", "--output-format", "$PROMPT"],
  environment: getCursorEnvironment,
  checkRequirements: checkCursorRequirements,
  apiKeys: [CURSOR_API_KEY],
  waitForString: "Ready",
};

export const CURSOR_SONNET_4_CONFIG: AgentConfig = {
  name: "cursor/sonnet-4",
  command: "/root/.local/bin/cursor-agent",
  args: ["--force", "--model", "sonnet-4", "--output-format", "$PROMPT"],
  environment: getCursorEnvironment,
  checkRequirements: checkCursorRequirements,
  apiKeys: [CURSOR_API_KEY],
  waitForString: "Ready",
};

export const CURSOR_SONNET_4_THINKING_CONFIG: AgentConfig = {
  name: "cursor/sonnet-4-thinking",
  command: "/root/.local/bin/cursor-agent",
  args: [
    "--force",
    "--model",
    "sonnet-4-thinking",
    "--output-format",
    "$PROMPT",
  ],
  environment: getCursorEnvironment,
  checkRequirements: checkCursorRequirements,
  apiKeys: [CURSOR_API_KEY],
  waitForString: "Ready",
};
