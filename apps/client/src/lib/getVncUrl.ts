/**
 * Extracts the morph instance ID from a workspace URL and constructs the VNC URL
 * @param workspaceUrl - The workspace URL (e.g., https://port-39378-morphvm-abc123.http.cloud.morph.so/?folder=/root/workspace)
 * @returns The VNC URL with auto-connect parameters, or null if not a morph instance
 */
export function getVncUrl(workspaceUrl: string | null | undefined): string | null {
  if (!workspaceUrl) return null;

  // Check if it's a morph.so URL
  if (!workspaceUrl.includes("morph.so")) return null;

  try {
    const url = new URL(workspaceUrl);
    const hostname = url.hostname;

    // Match format: port-{port}-morphvm-{morphId}.http.cloud.morph.so
    const match = hostname.match(
      /^port-(\d+)-morphvm-([^.]+)\.http\.cloud\.morph\.so$/
    );

    if (!match) return null;

    const [, , morphId] = match;

    // Construct VNC URL with auto-connect and scaling parameters
    // Port 39380 is the websockify/noVNC port
    const vncUrl = `https://port-39380-morphvm-${morphId}.http.cloud.morph.so/vnc.html?autoconnect=true&resize=scale`;

    return vncUrl;
  } catch {
    return null;
  }
}
