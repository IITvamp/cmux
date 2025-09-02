import { describe, it, expect } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { bytesToHex } from "./encoding";
import { hmacSha256, safeEqualHex, sha256Hex } from "./crypto";

describe("crypto utils", () => {
  it("sha256Hex matches node:crypto for common vectors", async () => {
    const vectors = ["", "abc", "The quick brown fox jumps over the lazy dog"];
    for (const v of vectors) {
      const expected = createHash("sha256").update(v, "utf8").digest("hex");
      const actual = await sha256Hex(v);
      expect(actual).toBe(expected);
    }
  });

  it("hmacSha256 matches node:crypto HMAC output", async () => {
    const key = "key";
    const msg = "The quick brown fox jumps over the lazy dog";
    const expected = createHmac("sha256", key).update(msg, "utf8").digest("hex");
    const sig = await hmacSha256(key, msg);
    const actual = bytesToHex(sig);
    expect(actual).toBe(expected);
  });

  it("safeEqualHex constant-time equality behavior", () => {
    expect(safeEqualHex("deadbeef", "deadbeef")).toBe(true);
    expect(safeEqualHex("deadbeef", "deadbeee")).toBe(false);
    expect(safeEqualHex("deadbeef", "feedbeef")).toBe(false);
  });
});
