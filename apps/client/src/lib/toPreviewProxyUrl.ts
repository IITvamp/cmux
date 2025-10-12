export function toPreviewProxyUrl(url: string): string {
  if (!url) {
    return url;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const hostname = parsed.hostname;
  const firstDotIndex = hostname.indexOf(".");
  const subdomain = firstDotIndex === -1 ? hostname : hostname.slice(0, firstDotIndex);

  if (!subdomain.startsWith("port-")) {
    return url;
  }

  let remainder = subdomain.slice("port-".length);
  if (remainder.length === 0) {
    return url;
  }

  remainder = remainder.replace(/morphvm-/g, "");
  const segments = remainder.split("-").filter(Boolean);

  if (segments.length < 2) {
    return url;
  }

  const portSegment = segments[0];
  if (!/^\d+$/.test(portSegment)) {
    return url;
  }

  const morphId = segments[1];
  if (!morphId) {
    return url;
  }

  const newHost = `cmux-${morphId}-base-${portSegment}.cmux.sh`;
  parsed.hostname = newHost;
  parsed.protocol = "https:";

  return parsed.toString();
}
