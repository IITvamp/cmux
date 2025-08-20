export * from "./agentConfig.js";

// Lazy-loaded anthropic exports using dynamic imports to avoid breaking browser builds
export const getAnthropicProviders = async () => {
  const module = await import("./providers/anthropic/index.js");
  return module;
};

export const getClaudeCompletionDetector = async () => {
  const module = await import("./providers/anthropic/completion-detector.js");
  return {
    checkClaudeStopHookCompletion: module.checkClaudeStopHookCompletion,
  };
};

// Lazy-loaded provider utilities for other providers
export const getOpenAIProviders = async () => {
  const module = await import("./providers/openai/index.js");
  return module;
};

export const getGeminiCompletionDetector = async () => {
  const module = await import("./providers/gemini/completion-detector.js");
  return module;
};

export * from "./convex-ready.js";
export * from "./getShortId.js";
export * from "./socket-schemas.js";
export * from "./terminal-config.js";
export * from "./vscode-schemas.js";
export * from "./worker-schemas.js";
export * from "./diff-types.js";
// Do NOT export Node-only utilities here; browser builds import this index.
