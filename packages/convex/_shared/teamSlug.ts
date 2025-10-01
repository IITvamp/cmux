export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 48;
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase();
}

export function validateSlug(slug: string): void {
  const normalized = normalizeSlug(slug);
  if (normalized.length < SLUG_MIN_LENGTH || normalized.length > SLUG_MAX_LENGTH) {
    throw new Error("Slug must be 3–48 characters long");
  }
  if (!SLUG_REGEX.test(normalized)) {
    throw new Error(
      "Slug can contain lowercase letters, numbers, and hyphens, and must start/end with a letter or number"
    );
  }
}

export function slugifyTeamName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function sanitizeTeamId(teamId: string): string {
  const sanitized = teamId.toLowerCase().replace(/[^a-z0-9]/g, "");
  return sanitized.length > 0 ? sanitized : "team";
}

export function deriveSlugPrefix(teamId: string): string {
  const sanitized = sanitizeTeamId(teamId);
  const prefixSource = sanitized.length >= 4 ? sanitized : `${sanitized}team`;
  return prefixSource.slice(0, 4);
}

export function buildSlugCandidate(teamId: string, displayName: string, attempt: number): string {
  const prefix = deriveSlugPrefix(teamId);
  const rawName = slugifyTeamName(displayName);
  const baseSource = rawName.length > 0 ? rawName : "team";
  const suffix = attempt > 0 ? attempt.toString(36) : undefined;

  const suffixLength = suffix ? suffix.length : 0;
  const hyphenCount = suffix ? 2 : 1;
  const maxBaseLength = Math.max(1, SLUG_MAX_LENGTH - prefix.length - suffixLength - hyphenCount);

  let base = baseSource.slice(0, maxBaseLength);
  if (base.length === 0) {
    base = "team".slice(0, Math.max(1, maxBaseLength));
  }
  if (maxBaseLength >= SLUG_MIN_LENGTH && base.length < SLUG_MIN_LENGTH) {
    base = (baseSource + "team").slice(0, Math.max(SLUG_MIN_LENGTH, Math.min(baseSource.length, maxBaseLength)));
    if (base.length < SLUG_MIN_LENGTH) {
      base = (base + "team").slice(0, Math.max(SLUG_MIN_LENGTH, Math.min(maxBaseLength, SLUG_MIN_LENGTH)));
    }
    base = base.slice(0, maxBaseLength);
  }

  const parts = suffix ? [prefix, base, suffix] : [prefix, base];
  let slug = parts.join("-");
  slug = normalizeSlug(slug).replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return slug;
}

export function extractSlugFromMetadata(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") {
    return undefined;
  }
  const candidate = (meta as Record<string, unknown>).slug;
  if (typeof candidate !== "string") {
    return undefined;
  }
  const normalized = normalizeSlug(candidate);
  try {
    validateSlug(normalized);
    return normalized;
  } catch (_error) {
    return undefined;
  }
}
