import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

export type EncryptedValue = {
  ciphertextB64: string;
  ivB64: string;
  authTagB64: string;
};

function b64(buf: Buffer): string {
  return buf.toString("base64");
}

function fromB64(s: string): Buffer {
  return Buffer.from(s, "base64");
}

export function getMasterKey(): Buffer {
  const keyB64 = process.env.ENV_SECRETS_KEK;
  if (keyB64 && keyB64.length > 0) {
    const key = fromB64(keyB64);
    if (key.length !== 32) {
      throw new Error("ENV_SECRETS_KEK must be 32 bytes base64-encoded");
    }
    return key;
  }
  // Dev fallback: generate ephemeral key; callers should not rely on decrypt across restarts
  // In production, require the env var
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing ENV_SECRETS_KEK in production");
  }
  return randomBytes(32);
}

export function deriveDataKey(masterKey: Buffer, salt: Buffer, info: string): Buffer {
  // HKDF-SHA256 derive 32-byte key
  return hkdfSync("sha256", masterKey, salt, Buffer.from(info, "utf8"), 32);
}

export function generateSalt(): string {
  return b64(randomBytes(16));
}

export function encryptWithAesGcm(key: Buffer, plaintext: Buffer): EncryptedValue {
  const iv = randomBytes(12); // 96-bit IV
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertextB64: b64(ciphertext),
    ivB64: b64(iv),
    authTagB64: b64(authTag),
  };
}

export function decryptWithAesGcm(key: Buffer, payload: EncryptedValue): Buffer {
  const iv = fromB64(payload.ivB64);
  const authTag = fromB64(payload.authTagB64);
  const ciphertext = fromB64(payload.ciphertextB64);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext;
}

export function encryptSecretValue(opts: {
  masterKey: Buffer;
  dataKeySaltB64: string;
  environmentId: string;
  value: string;
}): EncryptedValue {
  const dataKey = deriveDataKey(opts.masterKey, fromB64(opts.dataKeySaltB64), `env:${opts.environmentId}`);
  return encryptWithAesGcm(dataKey, Buffer.from(opts.value, "utf8"));
}

export function decryptSecretValue(opts: {
  masterKey: Buffer;
  dataKeySaltB64: string;
  environmentId: string;
  payload: EncryptedValue;
}): string {
  const dataKey = deriveDataKey(opts.masterKey, fromB64(opts.dataKeySaltB64), `env:${opts.environmentId}`);
  const buf = decryptWithAesGcm(dataKey, opts.payload);
  return buf.toString("utf8");
}

