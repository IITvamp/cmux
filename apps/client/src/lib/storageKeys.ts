const STORAGE_NAMESPACE = "cmux" as const;

export function selectedProjectStorageKey(teamSlugOrId: string): string {
  const suffix = teamSlugOrId?.trim() ?? "";
  const normalized = suffix.length > 0 ? suffix : "unknown-team";
  return `${STORAGE_NAMESPACE}:selectedProject:${normalized}`;
}
