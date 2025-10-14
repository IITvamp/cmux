const MORPH_HOST_REGEX = /^port-(\d+)-morphvm-([^.]+)\.http\.cloud\.morph\.so$/;

export interface MorphWorkspaceInfo {
  port: string;
  morphId: string;
}

export function parseMorphWorkspaceHostname(
  hostname: string
): MorphWorkspaceInfo | null {
  const match = hostname.match(MORPH_HOST_REGEX);
  if (!match) {
    return null;
  }

  const [, port, morphId] = match;
  return {
    port,
    morphId,
  };
}

export function buildMorphHostname({
  morphId,
  port,
  scope = "base",
}: {
  morphId: string;
  port: string | number;
  scope?: string;
}): string {
  return `cmux-${morphId}-${scope}-${String(port)}.cmux.app`;
}

export function toMorphPortUrl(
  workspaceUrl: string,
  targetPort: string | number,
  options?: {
    scope?: string;
    protocol?: "http" | "https";
    pathname?: string;
    searchParams?: Record<string, string>;
  }
): string | null {
  if (!workspaceUrl) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(workspaceUrl);
  } catch {
    return null;
  }

  const info = parseMorphWorkspaceHostname(url.hostname);
  if (!info) {
    return null;
  }

  const protocol = options?.protocol ?? "https";
  const scope = options?.scope ?? "base";
  const target = new URL(`${protocol}://${buildMorphHostname({
    morphId: info.morphId,
    port: targetPort,
    scope,
  })}`);

  if (options?.pathname) {
    target.pathname = options.pathname;
  }

  if (options?.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      target.searchParams.set(key, value);
    }
  }

  return target.toString();
}

export function toMorphVncUrl(workspaceUrl: string): string | null {
  return toMorphPortUrl(workspaceUrl, 39380, {
    pathname: "/vnc.html",
    searchParams: {
      autoconnect: "1",
      resize: "scale",
      scale: "local",
    },
  });
}

export function getMorphInstanceIdFromWorkspaceUrl(
  workspaceUrl: string
): string | null {
  if (!workspaceUrl) {
    return null;
  }

  try {
    const url = new URL(workspaceUrl);
    const info = parseMorphWorkspaceHostname(url.hostname);
    return info?.morphId ?? null;
  } catch {
    return null;
  }
}

export { MORPH_HOST_REGEX };
