export function refWithOrigin(ref: string) {
  if (ref.startsWith("origin/")) {
    return ref;
  }
  return `origin/${ref}`;
}
