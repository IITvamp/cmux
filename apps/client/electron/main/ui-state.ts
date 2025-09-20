import type { BrowserWindow } from "electron";

// Tracks per-window UI state (e.g., Command Palette open)
const commandPaletteOpenByWindow = new Map<number, boolean>();

type Listener = (windowId: number, open: boolean) => void;
const listeners = new Set<Listener>();

export function setCommandPaletteOpenForWindow(
  windowId: number,
  open: boolean
): void {
  const prev = commandPaletteOpenByWindow.get(windowId) ?? false;
  if (prev === open) return;
  commandPaletteOpenByWindow.set(windowId, open);
  for (const fn of Array.from(listeners)) {
    try {
      fn(windowId, open);
    } catch {
      // ignore listener errors
    }
  }
}

export function isCommandPaletteOpenForWindow(windowId: number): boolean {
  return commandPaletteOpenByWindow.get(windowId) === true;
}

export function onCommandPaletteOpenChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Optional helper to clear state for closed windows
export function clearWindowState(win: BrowserWindow | number | null | undefined) {
  const id = typeof win === "number" ? win : win?.id;
  if (typeof id !== "number") return;
  commandPaletteOpenByWindow.delete(id);
}

