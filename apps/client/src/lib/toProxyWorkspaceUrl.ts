export function toProxyWorkspaceUrl(workspaceUrl: string): string {
  if (workspaceUrl.includes("morph.so")) {
    // convert https://port-39378-morphvm-zqcjcumw.http.cloud.morph.so/?folder=/root/workspace
    // to https://cmux-zqcjcumw-base-39378.cmux.app/?folder=/root/workspace

    // Parse the URL to extract components
    const url = new URL(workspaceUrl);
    const hostname = url.hostname;

    // Match format: port-{port}-morphvm-{morphId}.http.cloud.morph.so
    const match = hostname.match(/^port-(\d+)-morphvm-([^.]+)\.http\.cloud\.morph\.so$/);

    if (match) {
      const [, port, morphId] = match;
      const scope = "base"; // Default scope

      // Reconstruct as cmux-{morphId}-{scope}-{port}.cmux.app
      const newHostname = `cmux-${morphId}-${scope}-${port}.cmux.app`;

      // Rebuild the URL with the new hostname
      url.hostname = newHostname;
      return url.toString();
    }

    // Fallback: simple string replacement if pattern doesn't match
    return workspaceUrl
      .replace(/morphvm-/g, "")
      .replace(/\.http\.cloud\.morph\.so/g, ".cmux.app");
  }

  return workspaceUrl;
}
