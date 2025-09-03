import { describe, it, expect } from "vitest";
import { parseEnvBlock, type ParsedEnv } from "./parseEnvBlock";

function entriesToRecord(entries: ParsedEnv[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) out[e.name] = e.value;
  return out;
}

describe("parseEnvBlock", () => {
  it("parses simple key=value and ignores comments/empty lines", () => {
    const input = [
      "FOO=bar",
      "# comment line",
      "BAZ=qux # inline comment",
      "   ",
      "// another comment",
      "QUUX = space trimmed",
    ].join("\n");
    const rec = entriesToRecord(parseEnvBlock(input));
    expect(rec).toEqual({
      FOO: "bar",
      BAZ: "qux",
      QUUX: "space trimmed",
    });
  });

  it("supports export/set prefixes and colon separator", () => {
    const input = [
      "export FOO=1",
      "set BAR=2",
      "BAZ: three",
      "ZED:four",
    ].join("\n");
    const rec = entriesToRecord(parseEnvBlock(input));
    expect(rec).toEqual({ FOO: "1", BAR: "2", BAZ: "three", ZED: "four" });
  });

  it("falls back to whitespace separation when no '=' or ':'", () => {
    const input = "FOO bar baz qux";
    const out = parseEnvBlock(input);
    expect(out).toEqual([{ name: "FOO", value: "bar baz qux" }]);
  });

  it("does not strip # without preceding whitespace for unquoted values", () => {
    const input = "FOO=bar#baz";
    const out = parseEnvBlock(input);
    expect(out).toEqual([{ name: "FOO", value: "bar#baz" }]);
  });

  it("handles quoted multiline values and escaped quotes", () => {
    const input = [
      String.raw`FOO="Hello\nWorld"`,
      String.raw`BAR="He said \"hi\"."`,
      "BAZ='multi\nline\nvalue'",
      "QUX:`tick\nline`",
    ].join("\n");
    const rec = entriesToRecord(parseEnvBlock(input));
    expect(rec["FOO"]).toBe(String.raw`Hello\nWorld`);
    expect(rec["BAR"]).toBe(String.raw`He said \"hi\".`);
    expect(rec["BAZ"]).toBe("multi\nline\nvalue");
    expect(rec["QUX"]).toBe("tick\nline");
  });

  it("collects until EOF when quote is not closed", () => {
    const input = ['FOO="Hello', "World"].join("\n");
    const out = parseEnvBlock(input);
    expect(out).toEqual([{ name: "FOO", value: "Hello\nWorld" }]);
  });

  it("supports no value after '=' and bare key with no separator", () => {
    const input = ["EMPTY=", "NOVALUE"].join("\n");
    const rec = entriesToRecord(parseEnvBlock(input));
    expect(rec).toEqual({ EMPTY: "", NOVALUE: "" });
  });

  it("normalizes CRLF newlines", () => {
    const input = "FOO=bar\r\nBAR=baz\r\n";
    const rec = entriesToRecord(parseEnvBlock(input));
    expect(rec).toEqual({ FOO: "bar", BAR: "baz" });
  });

  it("keeps inline comments outside of quotes", () => {
    const input = 'FOO="bar" # comment here';
    const out = parseEnvBlock(input);
    expect(out).toEqual([{ name: "FOO", value: "bar" }]);
  });
});
