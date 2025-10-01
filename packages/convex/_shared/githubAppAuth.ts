import { base64urlFromBytes, base64urlToBytes } from "./encoding";

const textEncoder = new TextEncoder();
const privateKeyCache = new Map<string, CryptoKey>();

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

function base64urlEncodeJson(value: unknown): string {
  return base64urlFromBytes(textEncoder.encode(JSON.stringify(value)));
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
    ["sign"],
  );
  privateKeyCache.set(pem, key);
  return key;
}

export function normalizeGithubPrivateKey(input: string): string {
  return input.replace(/\\n/g, "\n");
}

export async function createGithubAppJwt(
  appId: string,
  privateKey: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" } as const;
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  } as const;
  const signingInput = `${base64urlEncodeJson(header)}.${base64urlEncodeJson(
    payload,
  )}`;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("SubtleCrypto is not available in this environment");
  }
  const key = await importPrivateKey(privateKey);
  const signature = await subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    textEncoder.encode(signingInput),
  );
  const signaturePart = base64urlFromBytes(new Uint8Array(signature));
  return `${signingInput}.${signaturePart}`;
}

export type InstallationAccessToken = {
  token: string;
  expiresAt?: string;
};

export async function createInstallationAccessToken({
  appId,
  privateKey,
  installationId,
  userAgent = "cmux-github-app",
}: {
  appId: string;
  privateKey: string;
  installationId: number;
  userAgent?: string;
}): Promise<InstallationAccessToken | null> {
  const jwt = await createGithubAppJwt(appId, privateKey);
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": userAgent,
      },
    },
  );
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(
      `[githubAppAuth] Failed to create installation access token (${response.status})`,
      {
        installationId,
        status: response.status,
        body: errorText,
      },
    );
    return null;
  }
  const data = (await response.json()) as {
    token?: string;
    expires_at?: string;
  };
  const token = data.token;
  if (!token) {
    console.error(
      "[githubAppAuth] Installation access token response missing token",
      { installationId },
    );
    return null;
  }
  return { token, expiresAt: data.expires_at ?? undefined };
}

