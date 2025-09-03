import { describe, it, expect } from "vitest";
import { findUnescapedQuoteIndex } from "./findUnescapedQuoteIndex";

describe("findUnescapedQuoteIndex", () => {
  it("finds first unescaped double quote", () => {
    expect(findUnescapedQuoteIndex('abc"def"', '"')).toBe(3);
  });

  it("ignores escaped quotes", () => {
    expect(findUnescapedQuoteIndex(String.raw`abc\"def`, '"')).toBe(-1);
  });

  it("treats even-numbered backslashes as unescaped", () => {
    expect(findUnescapedQuoteIndex(String.raw`abc\\"def`, '"')).toBe(5);
  });

  it("works for single quotes", () => {
    expect(findUnescapedQuoteIndex("a\\'b'c", "'")).toBe(4);
  });

  it("works for backticks", () => {
    expect(findUnescapedQuoteIndex("a`b`c", "`")).toBe(1);
  });

  it("returns -1 when not found", () => {
    expect(findUnescapedQuoteIndex("abc", '"')).toBe(-1);
  });

  it("handles newlines in text", () => {
    expect(findUnescapedQuoteIndex("line1\nline2' end", "'")).toBe(11);
  });
});
