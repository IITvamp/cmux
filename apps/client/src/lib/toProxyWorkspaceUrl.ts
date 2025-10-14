const MORPH_HOST_REGEX = /^port-(\d+)-morphvm-([^.]+)\.http\.cloud\.morph\.so$/;
const PROXIED_HOST_REGEX = /^cmux-([^-]+)-([^-]+)-(\d+)\.cmux\.app$/;

function parseMorphHost(hostname: string): { morphId: string; port: string } | null {
  const directMatch = hostname.match(MORPH_HOST_REGEX);
  if (directMatch) {
    const [, port, morphId] = directMatch;
    return { morphId, port };
  }

  const proxiedMatch = hostname.match(PROXIED_HOST_REGEX);
  if (proxiedMatch) {
    const [, morphId, _scope, port] = proxiedMatch;
    return { morphId, port };
  }

  return null;
}

function buildProxyHostname({
  morphId,
  scope,
  port,
}: {
  morphId: string;
  scope: string;
  port: string;
}): string {
  return `cmux-${morphId}-${scope}-${port}.cmux.app`;
}

export function toProxyWorkspaceUrl(workspaceUrl: string): string {
  if (workspaceUrl.includes("morph.so") || workspaceUrl.includes("cmux-")) {
    const url = new URL(workspaceUrl);
    const hostInfo = parseMorphHost(url.hostname);

    if (!hostInfo) {
      throw new Error(`Invalid workspace URL: ${workspaceUrl}`);
    }

    const proxyHost = buildProxyHostname({
      morphId: hostInfo.morphId,
      scope: "base",
      port: hostInfo.port,
    });

    url.hostname = proxyHost;
    url.port = "";
    return url.toString();
  }

  return workspaceUrl;
}

export function toProxyBrowserUrl(vscodeBaseUrl: string): string {
  if (!vscodeBaseUrl.includes("morph.so") && !vscodeBaseUrl.includes("cmux-")) {
    throw new Error(`Browser view only supported for morph instances: ${vscodeBaseUrl}`);
  }

  const url = new URL(vscodeBaseUrl);
  const hostInfo = parseMorphHost(url.hostname);

  if (!hostInfo) {
    throw new Error(`Invalid morph VS Code URL: ${vscodeBaseUrl}`);
  }

  const proxyHost = buildProxyHostname({
    morphId: hostInfo.morphId,
    scope: "browser",
    port: "39380",
  });

  url.hostname = proxyHost;
  url.port = "";
  url.pathname = "/vnc.html";
  url.search = "";
  url.hash = "";
  url.searchParams.set("autoconnect", "true");
  url.searchParams.set("resize", "scale");

  return url.toString();
}
