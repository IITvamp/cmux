import { describe, it, expect } from "vitest";
import {
  base64urlFromBytes,
  base64urlToBytes,
  bytesToHex,
} from "./encoding";

describe("encoding utils", () => {
  it("base64urlFromBytes matches Buffer base64url for strings", () => {
    const inputs = ["hello", "hello world", "any carnal pleasure.", "", "\u0000\u0001\u0002\u00ff"];
    for (const s of inputs) {
      const expected = Buffer.from(s, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
      const actual = base64urlFromBytes(new TextEncoder().encode(s));
      expect(actual).toBe(expected);
    }
  });

  it("base64url roundtrip bytes -> b64url -> bytes", () => {
    const raw = new Uint8Array([0x00, 0x01, 0x02, 0x7f, 0x80, 0xfe, 0xff]);
    const b64 = base64urlFromBytes(raw);
    const roundtrip = base64urlToBytes(b64);
    expect([...roundtrip]).toEqual([...raw]);
  });

  it("base64url roundtrip string -> b64url -> string", () => {
    const s = "The quick brown fox jumps over the lazy dog";
    const b64 = base64urlFromBytes(new TextEncoder().encode(s));
    const dec = new TextDecoder().decode(base64urlToBytes(b64));
    expect(dec).toBe(s);
  });

  it("bytesToHex works for typical cases", () => {
    const bytes = new Uint8Array([0x00, 0x0f, 0x10, 0xff]);
    expect(bytesToHex(bytes)).toBe("000f10ff");
  });
});
