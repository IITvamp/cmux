import { v } from "convex/values";

/**
 * Stack metadata field validator
 *
 * Stack Auth allows arbitrary JSON in metadata fields (client_metadata,
 * client_read_only_metadata, server_metadata). These fields are validated
 * by Zod in the webhook handler as z.unknown().nullable().
 *
 * Unfortunately, Convex validators don't support truly recursive types,
 * so we cannot create a perfect JSON validator. The options are:
 *
 * 1. Use v.any() - Simple but loses all type safety
 * 2. Create a limited recursive validator - Better but still requires v.any() for deep nesting
 * 3. Define a specific schema if we know the structure - Best, but metadata is user-defined
 *
 * Since these metadata fields are:
 * - User-defined and can contain any structure
 * - Already validated at the webhook ingestion layer
 * - Passed through without modification
 *
 * We use v.any() here with clear documentation of why this is necessary.
 * This is one of the few legitimate uses of v.any() in our codebase.
 */
export const stackMetadataField = v.optional(v.any());