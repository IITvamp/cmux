import { cloneMutableHeaders, MutableHeaders } from "./headers.js";

const LOOPBACK_V4_REGEX = /^127(?:\.\d{1,3}){3}$/;

export function isLoopbackHostnameValue(
  hostname: string | null | undefined
): boolean {
  if (!hostname) {
    return false;
  }

  const normalized = hostname.toLowerCase();

  if (normalized === "localhost" || normalized === "0.0.0.0") {
    return true;
  }

  if (normalized === "::1" || normalized === "[::1]" || normalized === "::") {
    return true;
  }

  return LOOPBACK_V4_REGEX.test(normalized);
}

export function rewriteLoopbackRedirect(
  headers: MutableHeaders,
  buildProxyHost: (port: string) => string | null
): MutableHeaders {
  const mutated = cloneMutableHeaders(headers);
  const location = mutated["location"];
  if (!location) {
    return mutated;
  }

  let parsed: URL;
  try {
    parsed = new URL(location);
  } catch {
    return mutated;
  }

  if (!isLoopbackHostnameValue(parsed.hostname)) {
    return mutated;
  }

  const port = parsed.port;
  if (!port) {
    return mutated;
  }

  const proxyHost = buildProxyHost(port);
  if (!proxyHost) {
    return mutated;
  }

  parsed.protocol = "https:";
  parsed.hostname = proxyHost;
  parsed.port = "";

  const rewritten = parsed.toString();
  if (rewritten === location) {
    return mutated;
  }

  mutated["location"] = rewritten;
  return mutated;
}
