import { describe, expect, it } from "vitest";
import { resolveGithubPrivateKey } from "./githubPrivateKey";

const SAMPLE_PEM = `-----BEGIN PRIVATE KEY-----
ABCDEF123456
-----END PRIVATE KEY-----`;

describe("resolveGithubPrivateKey", () => {
  it("returns PEM content as-is when already formatted", () => {
    expect(resolveGithubPrivateKey(SAMPLE_PEM)).toBe(SAMPLE_PEM);
  });

  it("expands escaped newlines", () => {
    const escaped = SAMPLE_PEM.replace(/\n/g, "\\n");
    expect(resolveGithubPrivateKey(escaped)).toBe(SAMPLE_PEM);
  });

  it("decodes base64 encoded PEM", () => {
    const base64 = Buffer.from(SAMPLE_PEM, "utf8").toString("base64");
    expect(resolveGithubPrivateKey(base64)).toBe(SAMPLE_PEM);
  });

  it("throws for unsupported formats", () => {
    expect(() => resolveGithubPrivateKey("not-a-key"))
      .toThrowError(/Invalid GitHub App private key/);
  });
});
