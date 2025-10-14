interface ProxyWorkspaceUrlOptions {
  portOverride?: number;
  stripSearch?: boolean;
  path?: string;
}

export function toProxyWorkspaceUrl(
  workspaceUrl: string,
  options: ProxyWorkspaceUrlOptions = {}
): string {
  const url = new URL(workspaceUrl);

  if (workspaceUrl.includes("morph.so")) {
    // convert https://port-39378-morphvm-zqcjcumw.http.cloud.morph.so/?folder=/root/workspace
    // to https://cmux-zqcjcumw-base-39378.cmux.app/?folder=/root/workspace
    const hostname = url.hostname;

    const match = hostname.match(
      /^port-(\d+)-morphvm-([^.]+)\.http\.cloud\.morph\.so$/
    );

    if (!match) {
      throw new Error(`Invalid workspace URL: ${workspaceUrl}`);
    }

    const [, port, morphId] = match;
    const scope = "base";
    const targetPort = options.portOverride !== undefined
      ? String(options.portOverride)
      : port;

    url.hostname = `cmux-${morphId}-${scope}-${targetPort}.cmux.app`;
    url.port = "";
  }

  if (options.stripSearch) {
    url.search = "";
  }

  if (options.path !== undefined) {
    url.pathname = options.path;
  }

  return url.toString();
}
