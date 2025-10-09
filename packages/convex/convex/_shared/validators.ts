import { v } from "convex/values";

/**
 * TypeScript type for JSON-serializable values.
 * Use this for TypeScript type annotations.
 */
export type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Validator for arbitrary JSON-serializable values.
 * Use this instead of v.any() for metadata fields and webhook payloads
 * that accept any JSON-serializable data.
 */
export const jsonValue = v.union(
  v.null(),
  v.number(),
  v.boolean(),
  v.string(),
  v.array(v.any()),
  v.object({})
);
