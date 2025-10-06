export function toProxyWorkspaceUrl(workspaceUrl: string): string {
  if (workspaceUrl.includes("morph.so")) {
    // convert https://port-39378-morphvm-zqcjcumw.http.cloud.morph.so/?folder=/root/workspace
    // to https://port-39378-zqcjcumw.cmux.sh/?folder=/root/workspace
    return workspaceUrl
      .replace(/morphvm-/g, "")
      .replace(/\.http\.cloud\.morph\.so/g, ".cmux.sh");
  }

  return workspaceUrl;
}
