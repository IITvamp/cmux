export function extractMorphInstanceId(workspaceUrl?: string): string | null {
  if (!workspaceUrl) return null;

  // Match format: port-{port}-morphvm-{morphId}.http.cloud.morph.so
  const match = workspaceUrl.match(
    /morphvm-([^.]+)\.http\.cloud\.morph\.so/
  );

  return match ? match[1] : null;
}

export function buildVSCodeUrl(morphInstanceId: string): string {
  const port = 39378;
  const scope = "base";
  return `https://cmux-${morphInstanceId}-${scope}-${port}.cmux.app/?folder=/root/workspace`;
}

export function buildBrowserUrl(morphInstanceId: string, port: number): string {
  const scope = "base";
  return `https://cmux-${morphInstanceId}-${scope}-${port}.cmux.app/`;
}
