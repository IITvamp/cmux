import type { IncomingHttpHeaders } from "node:http";

import { REWRITTEN_RESPONSE_IGNORED_HEADERS } from "./rewriters.js";

export type MutableHeaders = Record<string, string>;

export function normalizeHeaderKey(key: string): string {
  return key.toLowerCase();
}

export function headersToMutable(headers: IncomingHttpHeaders): MutableHeaders {
  const map: MutableHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;
    const normalizedKey = normalizeHeaderKey(key);
    if (Array.isArray(value)) {
      map[normalizedKey] = value[value.length - 1] ?? "";
    } else {
      map[normalizedKey] = value;
    }
  }
  return map;
}

export function cloneMutableHeaders(headers: MutableHeaders): MutableHeaders {
  return { ...headers };
}

export function sanitizeRewrittenResponseHeaders(
  headers: MutableHeaders
): MutableHeaders {
  const mutated = cloneMutableHeaders(headers);
  for (const header of REWRITTEN_RESPONSE_IGNORED_HEADERS) {
    delete mutated[header];
  }
  return mutated;
}

export function stripCspHeaders(headers: MutableHeaders): MutableHeaders {
  const mutated = cloneMutableHeaders(headers);
  delete mutated["content-security-policy"];
  delete mutated["content-security-policy-report-only"];
  return mutated;
}

export function addPermissiveCors(headers: MutableHeaders): MutableHeaders {
  const mutated = cloneMutableHeaders(headers);
  mutated["access-control-allow-origin"] = "*";
  mutated["access-control-allow-methods"] =
    "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD";
  mutated["access-control-allow-headers"] = "*";
  mutated["access-control-expose-headers"] = "*";
  mutated["access-control-allow-credentials"] = "true";
  mutated["access-control-max-age"] = "86400";
  return mutated;
}

export function applyMutableHeaders(
  res: import("node:http").ServerResponse,
  headers: MutableHeaders
): void {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

export function mergeRequestHeaders(
  original: IncomingHttpHeaders,
  overrides: Record<string, string>
): IncomingHttpHeaders {
  const merged: IncomingHttpHeaders = { ...original };
  for (const [key, value] of Object.entries(overrides)) {
    merged[key.toLowerCase()] = value;
  }
  return merged;
}
