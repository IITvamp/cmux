const FAKE_CONVEX_ID_PREFIX = "fake-";

export function isFakeConvexId(id: string) {
  return id.startsWith(FAKE_CONVEX_ID_PREFIX);
}

export function createFakeConvexId() {
  return `${FAKE_CONVEX_ID_PREFIX}${crypto.randomUUID()}`;
}
