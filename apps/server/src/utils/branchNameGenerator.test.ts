import { describe, it, expect } from "vitest";
import {
  toKebabCase,
  generateRandomId,
  generateBranchName,
  generatePRTitle,
} from "./branchNameGenerator.js";

describe("toKebabCase", () => {
  it("should convert simple strings to kebab case", () => {
    expect(toKebabCase("Hello World")).toBe("hello-world");
    expect(toKebabCase("Add Dark Mode")).toBe("add-dark-mode");
    expect(toKebabCase("Fix Bug In Login")).toBe("fix-bug-in-login");
  });

  it("should handle special characters", () => {
    expect(toKebabCase("Hello@World!")).toBe("hello-world");
    expect(toKebabCase("Add (new) feature")).toBe("add-new-feature");
    expect(toKebabCase("Fix: bug #123")).toBe("fix-bug-123");
  });

  it("should remove quotes and apostrophes", () => {
    expect(toKebabCase("Don't break")).toBe("don-t-break");
    expect(toKebabCase('"quoted text"')).toBe("quoted-text");
    expect(toKebabCase("user's profile")).toBe("user-s-profile");
  });

  it("should handle multiple spaces and hyphens", () => {
    expect(toKebabCase("Hello   World")).toBe("hello-world");
    expect(toKebabCase("Hello---World")).toBe("hello-world");
    expect(toKebabCase("  Hello World  ")).toBe("hello-world");
  });

  it("should handle numbers", () => {
    expect(toKebabCase("Feature 123")).toBe("feature-123");
    expect(toKebabCase("v2.0 release")).toBe("v2-0-release");
  });

  it("should limit length to 50 characters", () => {
    const longString = "This is a very long string that should be truncated to fifty chars";
    const result = toKebabCase(longString);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result).toBe("this-is-a-very-long-string-that-should-be-truncate");
  });

  it("should handle edge cases", () => {
    expect(toKebabCase("")).toBe("");
    expect(toKebabCase("   ")).toBe("");
    expect(toKebabCase("---")).toBe("");
    expect(toKebabCase("a")).toBe("a");
  });

  it("should handle unicode and emojis", () => {
    expect(toKebabCase("Hello 🌍 World")).toBe("hello-world");
    expect(toKebabCase("café")).toBe("caf");
    expect(toKebabCase("naïve")).toBe("na-ve");
  });

  it("should handle camelCase by adding hyphens", () => {
    expect(toKebabCase("camelCase")).toBe("camel-case");
    expect(toKebabCase("handleCamelCaseWithHyphens")).toBe("handle-camel-case-with-hyphens");
    expect(toKebabCase("myVariableName")).toBe("my-variable-name");
    expect(toKebabCase("APIResponse")).toBe("api-response");
    expect(toKebabCase("HTTPSConnection")).toBe("https-connection");
    expect(toKebabCase("XMLHttpRequest")).toBe("xml-http-request");
    expect(toKebabCase("IOError")).toBe("io-error");
  });

  it("should handle mixed camelCase and spaces", () => {
    expect(toKebabCase("Add myNewFeature")).toBe("add-my-new-feature");
    expect(toKebabCase("Fix getUserById bug")).toBe("fix-get-user-by-id-bug");
    expect(toKebabCase("Update APIEndpoint")).toBe("update-api-endpoint");
  });

  it("should handle pluralized uppercase acronyms sensibly", () => {
    // Standalone plural acronyms
    expect(toKebabCase("PRs")).toBe("prs");
    expect(toKebabCase("APIs")).toBe("apis");
    expect(toKebabCase("IDs")).toBe("ids");
    expect(toKebabCase("URLs")).toBe("urls");

    // In phrases
    expect(toKebabCase("Fix PRs in UI")).toBe("fix-prs-in-ui");
    expect(toKebabCase("Handle APIs in URLs")).toBe("handle-apis-in-urls");

    // Followed by another capitalized word (camel-style)
    expect(toKebabCase("PRsFix")).toBe("prs-fix");
    expect(toKebabCase("APIsParser")).toBe("apis-parser");

    // With punctuation and numbers
    expect(toKebabCase("PRs: open 2")).toBe("prs-open-2");
    expect(toKebabCase("Track URLs2")).toBe("track-urls2");
  });
});

describe("generateRandomId", () => {
  it("should generate a 4-character string", () => {
    const id = generateRandomId();
    expect(id).toHaveLength(4);
  });

  it("should only contain lowercase letters and numbers", () => {
    const id = generateRandomId();
    expect(id).toMatch(/^[a-z0-9]{4}$/);
  });

  it("should generate different IDs", () => {
    const ids = new Set();
    for (let i = 0; i < 10; i++) {
      ids.add(generateRandomId());
    }
    // Should have at least 8 unique IDs out of 10 (allowing for rare collisions)
    expect(ids.size).toBeGreaterThanOrEqual(8);
  });
});

describe("generateBranchName", () => {
  it("should generate branch names in correct format", () => {
    const branchName = generateBranchName("Add new feature");
    expect(branchName).toMatch(/^cmux\/add-new-feature-[a-z0-9]{4}$/);
  });

  it("should handle PR titles with special characters", () => {
    const branchName = generateBranchName("Fix: Login bug #123");
    expect(branchName).toMatch(/^cmux\/fix-login-bug-123-[a-z0-9]{4}$/);
  });

  it("should handle empty PR title", () => {
    const branchName = generateBranchName("");
    expect(branchName).toMatch(/^cmux\/-[a-z0-9]{4}$/);
  });

  it("should handle very long PR titles", () => {
    const longTitle = "This is a very long PR title that should be truncated properly";
    const branchName = generateBranchName(longTitle);
    // The kebab part should be at most 50 chars, plus "cmux/" (5) and "-xxxx" (5)
    expect(branchName.length).toBeLessThanOrEqual(60);
    expect(branchName).toMatch(/^cmux\/[a-z0-9-]+-[a-z0-9]{4}$/);
  });
});

describe("generatePRTitle", () => {
  it("should return fallback when no API keys are provided", async () => {
    const result = await generatePRTitle("Add dark mode to settings", {});
    expect(result).toBe("Add dark mode to settings");
  });

  it("should handle very short descriptions", async () => {
    const result = await generatePRTitle("Fix", {});
    expect(result).toBe("Fix");
  });

  it("should handle empty description", async () => {
    const result = await generatePRTitle("", {});
    expect(result).toBe("feature-update");
  });

  it("should limit fallback to first 5 words", async () => {
    const longDescription = "This is a very long description with many words that should be truncated";
    const result = await generatePRTitle(longDescription, {});
    expect(result).toBe("This is a very long");
  });
});
