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
    expect(result).toBe("this-is-a-very-long-string-that-should-be-trunca");
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

  it("should handle uppercase acronyms with plurals and edge cases", () => {
    // Basic acronyms with plurals - the function splits before the 's'
    expect(toKebabCase("PRs")).toBe("p-rs");
    expect(toKebabCase("APIs")).toBe("ap-is");
    expect(toKebabCase("URLs")).toBe("ur-ls");
    expect(toKebabCase("IDs")).toBe("i-ds");
    
    // Acronyms in sentences
    expect(toKebabCase("Fix PRs in repository")).toBe("fix-p-rs-in-repository");
    expect(toKebabCase("Update APIs documentation")).toBe("update-ap-is-documentation");
    expect(toKebabCase("Handle multiple URLs")).toBe("handle-multiple-ur-ls");
    
    // Mixed case with acronyms
    expect(toKebabCase("updateAPIs")).toBe("update-ap-is");
    expect(toKebabCase("fixPRs")).toBe("fix-p-rs");
    expect(toKebabCase("parseURLs")).toBe("parse-ur-ls");
    
    // Acronyms with possessives
    expect(toKebabCase("PR's description")).toBe("pr-s-description");
    expect(toKebabCase("API's response")).toBe("api-s-response");
    
    // Multiple consecutive acronyms
    expect(toKebabCase("HTTPSURLs")).toBe("httpsur-ls");
    expect(toKebabCase("APIURLs")).toBe("apiur-ls");
    expect(toKebabCase("HTTPAPI")).toBe("httpapi");
    
    // Acronyms with numbers
    expect(toKebabCase("API2")).toBe("api2");
    expect(toKebabCase("PRs123")).toBe("p-rs123");
    expect(toKebabCase("URL404")).toBe("url404");
    
    // Edge cases with all caps
    expect(toKebabCase("ALLCAPS")).toBe("allcaps");
    expect(toKebabCase("MULTIPLE WORDS IN CAPS")).toBe("multiple-words-in-caps");
    expect(toKebabCase("FIX ALL PRs")).toBe("fix-all-p-rs");
    
    // Realistic PR titles with acronyms
    expect(toKebabCase("Fix CI/CD pipeline")).toBe("fix-ci-cd-pipeline");
    expect(toKebabCase("Update OAuth2 URLs")).toBe("update-o-auth2-ur-ls");
    expect(toKebabCase("Add SSL/TLS support")).toBe("add-ssl-tls-support");
    expect(toKebabCase("Fix NPM/YARN issues")).toBe("fix-npm-yarn-issues");
  });

  it("should handle complex acronym patterns", () => {
    // Acronyms at different positions
    expect(toKebabCase("PRs at start")).toBe("p-rs-at-start");
    expect(toKebabCase("middle APIs here")).toBe("middle-ap-is-here");
    expect(toKebabCase("end with URLs")).toBe("end-with-ur-ls");
    
    // Mixed acronym styles
    expect(toKebabCase("Html5APIs")).toBe("html5-ap-is");
    expect(toKebabCase("OAuth2URLs")).toBe("o-auth2-ur-ls");
    expect(toKebabCase("JSONAPIs")).toBe("jsonap-is");
    
    // Common developer acronyms
    expect(toKebabCase("REST APIs")).toBe("rest-ap-is");
    expect(toKebabCase("GraphQL APIs")).toBe("graph-ql-ap-is");
    expect(toKebabCase("SQL DBs")).toBe("sql-d-bs");
    expect(toKebabCase("NoSQL DBs")).toBe("no-sql-d-bs");
    expect(toKebabCase("K8s pods")).toBe("k8s-pods");
    expect(toKebabCase("AWS S3")).toBe("aws-s3");
    expect(toKebabCase("GCP VMs")).toBe("gcp-v-ms");
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