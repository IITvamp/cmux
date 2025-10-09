import { v } from "convex/values";

import { extractSlugFromMetadata } from "./teamSlug";

export const stackMetadataValidator = v.object({
  slug: v.optional(v.string()),
});

export type StackMetadata = {
  slug?: string;
};

export function sanitizeStackMetadata(value: unknown): StackMetadata | undefined {
  const slug = extractSlugFromMetadata(value);
  if (slug) {
    return { slug };
  }
  return undefined;
}
