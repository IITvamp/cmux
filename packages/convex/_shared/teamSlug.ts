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
  const trimmed = name.trim();
  const emailLocal = extractEmailLocalPart(trimmed);
  const source = emailLocal ?? trimmed;
  return source
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function extractEmailLocalPart(input: string): string | undefined {
  const match = input.match(/^[^@\s]+@[^@\s]+$/);
  if (!match) {
    return undefined;
  }
  const [local] = input.split("@");
  return local ?? undefined;
}

function sanitizeTeamId(teamId: string): string {
  const sanitized = teamId.toLowerCase().replace(/[^a-z0-9]/g, "");
  return sanitized.length > 0 ? sanitized : "team";
}

export function deriveSlugSuffix(teamId: string): string {
  const sanitized = sanitizeTeamId(teamId);
  const suffixSource = sanitized.length >= 4 ? sanitized : `${sanitized}team`;
  return suffixSource.slice(0, 4);
}

export function buildSlugCandidate(teamId: string, displayName: string, attempt: number): string {
  const rawBase = slugifyTeamName(displayName);
  const baseFallback = rawBase.length > 0 ? rawBase : "team";
  const suffix = deriveSlugSuffix(teamId);
  const attemptSuffix = attempt > 0 ? `${suffix}-${attempt.toString(36)}` : suffix;

  const maxBaseLength = Math.max(1, SLUG_MAX_LENGTH - attemptSuffix.length - 1);
  let base = baseFallback.slice(0, maxBaseLength);
  if (base.length === 0) {
    base = "team".slice(0, Math.max(1, maxBaseLength));
  }
  if (maxBaseLength >= SLUG_MIN_LENGTH && base.length < SLUG_MIN_LENGTH) {
    const padded = (baseFallback + "team").slice(0, Math.max(SLUG_MIN_LENGTH, maxBaseLength));
    base = padded.length >= SLUG_MIN_LENGTH ? padded : (padded + "team").slice(0, Math.max(SLUG_MIN_LENGTH, maxBaseLength));
  }

  const slug = `${base}-${attemptSuffix}`;
  return normalizeSlug(slug).replace(/-+/g, "-").replace(/^-+|-+$/g, "");
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
