import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export function getModelAndProvider(apiKeys: Record<string, string>): { model: LanguageModel; providerName: string } | null {
  if (apiKeys.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: apiKeys.OPENAI_API_KEY });
    return { model: openai("gpt-5-nano"), providerName: "OpenAI" };
  }
  if (apiKeys.GEMINI_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: apiKeys.GEMINI_API_KEY });
    return { model: google("gemini-2.5-flash"), providerName: "Gemini" };
  }
  if (apiKeys.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: apiKeys.ANTHROPIC_API_KEY });
    return { model: anthropic("claude-3-5-haiku-20241022"), providerName: "Anthropic" };
  }
  return null;
}