import { describe, expect, test } from "vitest";
import {
  buildSlugCandidate,
  deriveSlugSuffix,
  extractSlugFromMetadata,
  normalizeSlug,
  slugifyTeamName,
  validateSlug,
} from "./teamSlug";

describe("teamSlug helpers", () => {
  test("normalizeSlug trims and lowercases input", () => {
    expect(normalizeSlug("  My-Slug  ")).toBe("my-slug");
  });

  test("validateSlug rejects short slugs", () => {
    expect(() => validateSlug("ab")).toThrowError(
      "Slug must be 3–48 characters long",
    );
  });

  test("validateSlug rejects invalid characters", () => {
    expect(() => validateSlug("bad slug")).toThrowError(
      "Slug can contain lowercase letters, numbers, and hyphens, and must start/end with a letter or number",
    );
  });

  test("slugifyTeamName produces lowercase hyphenated names", () => {
    expect(slugifyTeamName("Frontend Wizards!")).toBe("frontend-wizards");
  });

  test("slugifyTeamName extracts email local part", () => {
    expect(slugifyTeamName("user@example.com")).toBe("user");
  });

  test("deriveSlugSuffix uses sanitized team id", () => {
    expect(deriveSlugSuffix("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e",
    );
    expect(deriveSlugSuffix("@@id")).toBe("idte");
  });

  test("buildSlugCandidate combines name and suffix", () => {
    const slug = buildSlugCandidate(
      "550e8400-e29b-41d4-a716-446655440000",
      "Frontend Wizards",
      0,
    );
    expect(slug).toBe("frontend-wizards-550e");
  });

  test("buildSlugCandidate appends attempt suffix", () => {
    const slug = buildSlugCandidate(
      "550e8400-e29b-41d4-a716-446655440000",
      "Frontend Wizards",
      2,
    );
    expect(slug).toBe("frontend-wizards-550e-2");
  });

  test("buildSlugCandidate respects maximum length", () => {
    const longName = "A".repeat(80);
    const slug = buildSlugCandidate(
      "550e8400-e29b-41d4-a716-446655440000",
      longName,
      5,
    );
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(() => validateSlug(slug)).not.toThrow();
  });

  test("buildSlugCandidate handles email names", () => {
    const slug = buildSlugCandidate(
      "550e8400-e29b-41d4-a716-446655440000",
      "user@example.com",
      0,
    );
    expect(slug).toBe("user-550e");
  });

  test("extractSlugFromMetadata normalizes valid slug", () => {
    const slug = extractSlugFromMetadata({ slug: "  My-Team  " });
    expect(slug).toBe("my-team");
  });

  test("extractSlugFromMetadata ignores invalid slug", () => {
    expect(extractSlugFromMetadata({ slug: "!" })).toBeUndefined();
  });
});
