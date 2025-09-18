import { Buffer } from "node:buffer";

const keyRegex =
  /^\s*(?:export\s+|set\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

const quoteValue = (rawValue: string): string => {
  const trimmed = rawValue.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed;
  }

  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const inner = trimmed.slice(1, -1).replace(/"/g, '\\"');
    return `"${inner}"`;
  }

  const escaped = rawValue.replace(/"/g, '\\"');
  return `"${escaped}"`;
};

export function ensureQuotedEnvVarsContent(content: string): string {
  const normalized = content.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const entries: string[] = [];

  let currentKey: string | null = null;
  let currentValueLines: string[] = [];

  const flush = () => {
    if (!currentKey) {
      currentValueLines = [];
      return;
    }

    const rawValue = currentValueLines.join("\n");
    const quoted = quoteValue(rawValue);
    entries.push(`${currentKey}=${quoted}`);
    currentKey = null;
    currentValueLines = [];
  };

  for (const line of lines) {
    const match = line.match(keyRegex);
    if (match) {
      flush();
      currentKey = match[1];
      currentValueLines = [match[2] ?? ""];
      continue;
    }

    if (currentKey) {
      currentValueLines.push(line);
    }
  }

  flush();

  return entries.join("\n");
}

export const envctlLoadCommand = (encodedEnv: string): string =>
  `bash -lc "envctl load --base64 '${encodedEnv}'"`;

export const encodeEnvContentForEnvctl = (content: string): string => {
  const safe = ensureQuotedEnvVarsContent(content);
  return Buffer.from(safe, "utf8").toString("base64");
};
