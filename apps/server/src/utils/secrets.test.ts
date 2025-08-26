import { describe, it, expect } from "vitest";
import {
  decryptSecretValue,
  decryptWithAesGcm,
  deriveDataKey,
  encryptSecretValue,
  encryptWithAesGcm,
  generateSalt,
  getMasterKey,
} from "./secrets.js";

describe("secrets encryption", () => {
  it("encrypts and decrypts with AES-GCM (direct)", () => {
    const key = Buffer.alloc(32, 7);
    const payload = encryptWithAesGcm(key, Buffer.from("hello", "utf8"));
    const out = decryptWithAesGcm(key, payload).toString("utf8");
    expect(out).toBe("hello");
  });

  it("produces different ciphertext with different IVs", () => {
    const key = Buffer.alloc(32, 9);
    const p1 = encryptWithAesGcm(key, Buffer.from("same", "utf8"));
    const p2 = encryptWithAesGcm(key, Buffer.from("same", "utf8"));
    expect(p1.ciphertextB64).not.toBe(p2.ciphertextB64);
    expect(p1.ivB64).not.toBe(p2.ivB64);
  });

  it("HKDF derives consistent keys for same inputs", () => {
    const master = Buffer.alloc(32, 1);
    const salt = Buffer.alloc(16, 2);
    const k1 = deriveDataKey(master, salt, "env:abc");
    const k2 = deriveDataKey(master, salt, "env:abc");
    expect(k1.equals(k2)).toBe(true);
  });

  it("envelope scheme encrypts and decrypts per environment", () => {
    const masterKey = Buffer.alloc(32, 3);
    const saltB64 = generateSalt();
    const envId = "env123";
    const payload = encryptSecretValue({
      masterKey,
      dataKeySaltB64: saltB64,
      environmentId: envId,
      value: "super-secret",
    });
    const out = decryptSecretValue({
      masterKey,
      dataKeySaltB64: saltB64,
      environmentId: envId,
      payload,
    });
    expect(out).toBe("super-secret");
  });

  it("fails to decrypt with wrong envId or salt", () => {
    const masterKey = Buffer.alloc(32, 4);
    const saltB64 = generateSalt();
    const payload = encryptSecretValue({
      masterKey,
      dataKeySaltB64: saltB64,
      environmentId: "envA",
      value: "abc",
    });
    // wrong envId
    expect(() =>
      decryptSecretValue({
        masterKey,
        dataKeySaltB64: saltB64,
        environmentId: "envB",
        payload,
      })
    ).toThrow();
    // wrong salt
    expect(() =>
      decryptSecretValue({
        masterKey,
        dataKeySaltB64: generateSalt(),
        environmentId: "envA",
        payload,
      })
    ).toThrow();
  });

  it("reads master key or generates dev fallback", () => {
    const prev = process.env.ENV_SECRETS_KEK;
    delete process.env.ENV_SECRETS_KEK;
    const key = getMasterKey();
    expect(key.length).toBe(32);
    if (prev) process.env.ENV_SECRETS_KEK = prev;
  });
});

