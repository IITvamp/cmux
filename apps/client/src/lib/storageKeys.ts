const SELECTED_PROJECT_STORAGE_KEY_PREFIX = "cmux:selectedProject" as const;

export const teamSelectedProjectStorageKey = (teamSlugOrId: string) =>
  `${SELECTED_PROJECT_STORAGE_KEY_PREFIX}:${teamSlugOrId}`;
