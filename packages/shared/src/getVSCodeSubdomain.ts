interface VSCodeSubdomainOptions {
  taskRunId: string;
  containerName?: string | null;
}

function sanitizeLabel(label: string): string {
  const lower = label.toLowerCase();
  const sanitized = lower.replace(/[^a-z0-9-]/g, "-");
  const collapsed = sanitized.replace(/-+/g, "-");
  const trimmed = collapsed.replace(/^-+|-+$/g, "");
  const maxLength = 63;
  const result = trimmed.slice(0, maxLength);
  return result || "cmux";
}

export function getVSCodeSubdomain({
  taskRunId,
  containerName,
}: VSCodeSubdomainOptions): string {
  const fromContainer = containerName
    ?.replace(/^docker-/i, "")
    .replace(/^cmux-/i, "");

  const base =
    fromContainer && fromContainer.length > 0 ? fromContainer : taskRunId;

  return sanitizeLabel(base);
}
