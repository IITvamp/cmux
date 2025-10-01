import { describe, expect, test } from "vitest";
import {
  buildSlugCandidate,
  deriveSlugPrefix,
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

  test("deriveSlugPrefix uses sanitized team id", () => {
    expect(deriveSlugPrefix("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e",
    );
    expect(deriveSlugPrefix("@@id")).toBe("idte");
  });

  test("buildSlugCandidate combines prefix and slugified name", () => {
    const slug = buildSlugCandidate(
      "550e8400-e29b-41d4-a716-446655440000",
      "Frontend Wizards",
      0,
    );
    expect(slug).toBe("550e-frontend-wizards");
  });

  test("buildSlugCandidate appends suffix for later attempts", () => {
    const slug = buildSlugCandidate(
      "550e8400-e29b-41d4-a716-446655440000",
      "Frontend Wizards",
      2,
    );
    expect(slug).toBe("550e-frontend-wizards-2");
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

  test("extractSlugFromMetadata normalizes valid slug", () => {
    const slug = extractSlugFromMetadata({ slug: "  My-Team  " });
    expect(slug).toBe("my-team");
  });

  test("extractSlugFromMetadata ignores invalid slug", () => {
    expect(extractSlugFromMetadata({ slug: "!" })).toBeUndefined();
  });
});
