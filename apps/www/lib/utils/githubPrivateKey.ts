import { env } from "./www-env";

const PEM_HEADER_PATTERN = /-----BEGIN [\w\s]+-----/;

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function expandEscapedNewlines(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function isLikelyBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/=]+$/.test(value);
}

function tryDecodeBase64(value: string): string | null {
  const compact = value.replace(/[\r\n\s]+/g, "");
  if (!isLikelyBase64(compact)) return null;
  try {
    const decoded = Buffer.from(compact, "base64").toString("utf8");
    const normalized = expandEscapedNewlines(normalizeNewlines(decoded.trim()));
    return PEM_HEADER_PATTERN.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export function resolveGithubPrivateKey(rawValue: string): string {
  const trimmed = rawValue.trim();
  const normalized = expandEscapedNewlines(normalizeNewlines(trimmed));

  if (PEM_HEADER_PATTERN.test(normalized)) {
    return normalized;
  }

  const decoded = tryDecodeBase64(normalized);
  if (decoded) {
    return decoded;
  }

  throw new Error(
    "Invalid GitHub App private key: expected PEM content or base64-encoded PEM"
  );
}

export const githubPrivateKey = resolveGithubPrivateKey(
  env.CMUX_GITHUB_APP_PRIVATE_KEY
);
