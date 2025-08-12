/**
 * Sanitize a string to be used as a tmux session name.
 * Tmux session names cannot contain: periods (.), colons (:), spaces, or other special characters.
 * We'll replace them with underscores to ensure compatibility.
 */
export function sanitizeTmuxSessionName(name: string): string {
  // Replace all invalid characters with underscores
  // Allow only alphanumeric characters, hyphens, and underscores
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}
