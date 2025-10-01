import { base64urlFromBytes, base64urlToBytes } from "./encoding";

const textEncoder = new TextEncoder();
const privateKeyCache = new Map<string, CryptoKey>();

export function normalizeGithubPrivateKey(pem: string): string {
  return pem.replace(/\\n/g, "\n");
}

function pemToDer(pem: string): Uint8Array {
  const cleaned = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const base64Url = cleaned
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return base64urlToBytes(base64Url);
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cached = privateKeyCache.get(pem);
  if (cached) return cached;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("SubtleCrypto is not available in this environment");
  }
  const der = pemToDer(pem);
  const keyData =
    der.byteOffset === 0 && der.byteLength === der.buffer.byteLength
      ? der
      : der.slice();
  const key = await subtle.importKey(
    "pkcs8",
    keyData,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  privateKeyCache.set(pem, key);
  return key;
}

function base64urlEncodeJson(value: unknown): string {
  return base64urlFromBytes(textEncoder.encode(JSON.stringify(value)));
}

export async function createGithubAppJwt({
  appId,
  privateKey,
  now,
}: {
  appId: string;
  privateKey: string;
  now?: number;
}): Promise<string> {
  const seconds = Math.floor((now ?? Date.now()) / 1000);
  const header = { alg: "RS256", typ: "JWT" } as const;
  const payload = {
    iat: seconds - 60,
    exp: seconds + 600,
    iss: appId,
  } as const;
  const signingInput = `${base64urlEncodeJson(header)}.${base64urlEncodeJson(
    payload
  )}`;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("SubtleCrypto is not available in this environment");
  }
  const key = await importPrivateKey(privateKey);
  const signature = await subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    textEncoder.encode(signingInput)
  );
  const signaturePart = base64urlFromBytes(new Uint8Array(signature));
  return `${signingInput}.${signaturePart}`;
}

export async function generateInstallationAccessToken({
  installationId,
  appId,
  privateKey,
  userAgent = "cmux-github-webhook",
}: {
  installationId: number;
  appId: string;
  privateKey: string;
  userAgent?: string;
}): Promise<{ token: string; expiresAt?: string } | null> {
  if (!appId || !privateKey) {
    return null;
  }
  try {
    const jwt = await createGithubAppJwt({
      appId,
      privateKey,
    });
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "User-Agent": userAgent,
        },
      }
    );
    if (!response.ok) {
      console.error(
        `[githubApp] Failed to mint installation token ${installationId} (status ${response.status})`
      );
      return null;
    }
    const data = (await response.json()) as {
      token?: string;
      expires_at?: string;
    };
    if (!data.token) {
      console.error(
        `[githubApp] No token returned for installation ${installationId}`
      );
      return null;
    }
    return { token: data.token, expiresAt: data.expires_at };
  } catch (error) {
    console.error(
      `[githubApp] Unexpected error generating installation token ${installationId}`,
      error
    );
    return null;
  }
}
