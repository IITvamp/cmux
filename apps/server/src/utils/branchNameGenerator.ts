import { api } from "@cmux/convex/api";
import { convex } from "../utils/convexClient.js";
import { serverLogger } from "./fileLogger.js";

/**
 * Convert a string to kebab case and filter out suspicious characters
 * @param input The input string to convert
 * @returns The kebab-cased string with only safe characters
 */
export function toKebabCase(input: string): string {
  return input
    // Treat pluralized acronyms like "PRs"/"APIs"/"IDs" as single tokens
    // - If a word starts with 2+ capitals followed by a lone lowercase 's',
    //   optionally followed by another capitalized sequence, keep the 's' with the acronym
    //   so we don't insert a hyphen inside it (e.g., "PRs" -> "PRS", "PRsFix" -> "PRSFix").
    .replace(/\b([A-Z]{2,})s(?=\b|[^a-z])/g, "$1S")
    // First, handle camelCase by inserting hyphens before capital letters
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    // Also handle sequences like "HTTPServer" -> "HTTP-Server"
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    // Replace any sequence of non-alphanumeric characters with a single hyphen
    .replace(/[^a-z0-9]+/g, "-")
    // Remove leading and trailing hyphens
    .replace(/^-+|-+$/g, "")
    // Replace multiple consecutive hyphens with a single hyphen
    .replace(/-+/g, "-")
    // Limit length to 50 characters
    .substring(0, 50);
}

/**
 * Generate a random 4-digit string
 * @returns A 4-character alphanumeric string
 */
export function generateRandomId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a branch name from a PR title
 * @param prTitle The PR title to convert to a branch name
 * @returns A branch name in the format cmux/feature-name-xxxx
 */
export function generateBranchName(prTitle: string): string {
  const kebabTitle = toKebabCase(prTitle);
  const randomId = generateRandomId();
  return `cmux/${kebabTitle}-${randomId}`;
}

/**
 * Call an LLM to generate a PR title from a task description
 * @param taskDescription The task description
 * @param apiKeys Map of API keys
 * @returns The generated PR title or null if no API keys available
 */
export async function generatePRTitle(
  taskDescription: string,
  apiKeys: Record<string, string>
): Promise<string | null> {
  // Try OpenAI first
  if (apiKeys.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKeys.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that generates concise PR titles. Generate a single PR title (5-10 words) that summarizes the task. Respond with ONLY the title, no quotes, no explanation.",
            },
            {
              role: "user",
              content: `Task: ${taskDescription}`,
            },
          ],
          max_tokens: 50,
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const prTitle = data.choices?.[0]?.message?.content?.trim();
        if (prTitle) {
          serverLogger.info(`[BranchNameGenerator] Generated PR title via OpenAI: ${prTitle}`);
          return prTitle;
        }
      }
    } catch (error) {
      serverLogger.error("[BranchNameGenerator] OpenAI API error:", error);
    }
  }

  // Try Anthropic
  if (apiKeys.ANTHROPIC_API_KEY) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKeys.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          messages: [
            {
              role: "user",
              content: `Generate a concise PR title (5-10 words) for this task. Respond with ONLY the title, no quotes, no explanation.\n\nTask: ${taskDescription}`,
            },
          ],
          max_tokens: 50,
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const prTitle = data.content?.[0]?.text?.trim();
        if (prTitle) {
          serverLogger.info(`[BranchNameGenerator] Generated PR title via Anthropic: ${prTitle}`);
          return prTitle;
        }
      }
    } catch (error) {
      serverLogger.error("[BranchNameGenerator] Anthropic API error:", error);
    }
  }

  // Try Gemini
  if (apiKeys.GEMINI_API_KEY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeys.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Generate a concise PR title (5-10 words) for this task. Respond with ONLY the title, no quotes, no explanation.\n\nTask: ${taskDescription}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 50,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const prTitle = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (prTitle) {
          serverLogger.info(`[BranchNameGenerator] Generated PR title via Gemini: ${prTitle}`);
          return prTitle;
        }
      }
    } catch (error) {
      serverLogger.error("[BranchNameGenerator] Gemini API error:", error);
    }
  }

  // Fallback: generate a simple title from the task description
  serverLogger.warn("[BranchNameGenerator] No API keys available, using fallback");
  const words = taskDescription.split(/\s+/).slice(0, 5).join(" ");
  return words || "feature-update";
}

/**
 * Generate a base name for branches (without the unique ID)
 * @param taskDescription The task description
 * @returns The base branch name without ID
 */
export async function generateBranchBaseName(
  taskDescription: string
): Promise<string> {
  // Fetch API keys from Convex
  const apiKeys = await convex.query(api.apiKeys.getAllForAgents);
  
  const prTitle = await generatePRTitle(taskDescription, apiKeys);
  const titleToUse = prTitle || taskDescription.split(/\s+/).slice(0, 5).join(" ") || "feature";
  const kebabTitle = toKebabCase(titleToUse);
  return `cmux/${kebabTitle}`;
}

/**
 * Generate a new branch name for a task run with a specific ID
 * @param taskDescription The task description
 * @param uniqueId Optional unique ID to use (if not provided, generates one)
 * @returns The generated branch name
 */
export async function generateNewBranchName(
  taskDescription: string,
  uniqueId?: string
): Promise<string> {
  const baseName = await generateBranchBaseName(taskDescription);
  const id = uniqueId || generateRandomId();
  return `${baseName}-${id}`;
}

/**
 * Generate multiple unique branch names at once
 * @param taskDescription The task description
 * @param count Number of branch names to generate
 * @returns Array of unique branch names
 */
export async function generateUniqueBranchNames(
  taskDescription: string,
  count: number
): Promise<string[]> {
  const baseName = await generateBranchBaseName(taskDescription);
  
  // Generate unique IDs
  const ids = new Set<string>();
  while (ids.size < count) {
    ids.add(generateRandomId());
  }
  
  return Array.from(ids).map(id => `${baseName}-${id}`);
}
