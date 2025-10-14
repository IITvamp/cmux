import { buildMorphHostname, parseMorphWorkspaceHostname } from "./morphWorkspace";

export function toProxyWorkspaceUrl(workspaceUrl: string): string {
  if (workspaceUrl.includes("morph.so")) {
    const url = new URL(workspaceUrl);
    const info = parseMorphWorkspaceHostname(url.hostname);

    if (!info) {
      throw new Error(`Invalid workspace URL: ${workspaceUrl}`);
    }

    url.hostname = buildMorphHostname({
      morphId: info.morphId,
      port: info.port,
    });

    return url.toString();
  }

  return workspaceUrl;
}
