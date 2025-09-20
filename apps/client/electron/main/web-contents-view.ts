import {
  BrowserWindow,
  WebContentsView,
  ipcMain,
  type Rectangle,
  type WebContents,
} from "electron";
import { applyChromeCamouflage, type Logger } from "./chrome-camouflage";

interface RegisterOptions {
  logger: Logger;
  maxSuspendedEntries?: number;
}

interface CreateOptions {
  url: string;
  bounds?: Rectangle;
  backgroundColor?: string;
  borderRadius?: number;
  persistKey?: string;
}

interface SetBoundsOptions {
  id: number;
  bounds: Rectangle;
  visible?: boolean;
}

interface LoadUrlOptions {
  id: number;
  url: string;
}

interface UpdateStyleOptions {
  id: number;
  backgroundColor?: string;
  borderRadius?: number;
}

interface ReleaseOptions {
  id: number;
  persist?: boolean;
}

interface Entry {
  id: number;
  view: Electron.WebContentsView;
  ownerWindowId: number;
  ownerWebContentsId: number;
  persistKey?: string;
  suspended: boolean;
  ownerWebContentsDestroyed: boolean;
}


const viewEntries = new Map<number, Entry>();
let nextViewId = 1;
const windowCleanupRegistered = new Set<number>();
const suspendedQueue: number[] = [];
const suspendedByKey = new Map<string, Entry>();
let suspendedCount = 0;
let maxSuspendedEntries = 25;

function setMaxSuspendedEntries(limit: number | undefined): number {
  if (
    typeof limit !== "number" ||
    Number.isNaN(limit) ||
    !Number.isFinite(limit) ||
    limit < 0
  ) {
    maxSuspendedEntries = 25;
    return maxSuspendedEntries;
  }
  maxSuspendedEntries = Math.floor(limit);
  return maxSuspendedEntries;
}

function cleanupViewsForWindow(windowId: number) {
  for (const [id, entry] of Array.from(viewEntries.entries())) {
    if (entry.ownerWindowId === windowId) {
      destroyView(id);
    }
  }
}

function removeFromSuspended(entry: Entry) {
  if (entry.persistKey) {
    const current = suspendedByKey.get(entry.persistKey);
    if (current?.id === entry.id) {
      suspendedByKey.delete(entry.persistKey);
    }
  }
  const index = suspendedQueue.indexOf(entry.id);
  if (index !== -1) {
    suspendedQueue.splice(index, 1);
  }
  if (entry.suspended) {
    entry.suspended = false;
    if (suspendedCount > 0) {
      suspendedCount -= 1;
    }
  }
}

function markSuspended(entry: Entry) {
  if (entry.suspended) return;
  entry.suspended = true;
  suspendedCount += 1;
  if (entry.persistKey) {
    suspendedByKey.set(entry.persistKey, entry);
  }
  suspendedQueue.push(entry.id);
}

function evictExcessSuspended(logger: Logger) {
  while (suspendedCount > maxSuspendedEntries) {
    const nextId = suspendedQueue.shift();
    if (typeof nextId !== "number") {
      break;
    }
    const entry = viewEntries.get(nextId);
    if (!entry || !entry.suspended) {
      continue;
    }
    logger.warn("Evicting suspended WebContentsView due to limit", {
      persistKey: entry.persistKey,
      webContentsId: entry.view.webContents.id,
    });
    destroyView(entry.id);
  }
}

function suspendEntriesForDestroyedOwner(
  windowId: number,
  webContentsId: number,
  logger: Logger
) {
  logger.log("Renderer destroyed; evaluating owned WebContentsViews", {
    windowId,
    webContentsId,
  });
  let suspendedAny = false;
  for (const entry of Array.from(viewEntries.values())) {
    if (entry.ownerWindowId !== windowId || entry.ownerWebContentsId !== webContentsId) {
      continue;
    }

    if (!entry.persistKey) {
      logger.log("Renderer destroyed; dropping non-persistent WebContentsView", {
        id: entry.id,
        webContentsId: entry.view.webContents.id,
      });
      destroyView(entry.id);
      suspendedAny = true;
      continue;
    }

    logger.log("Renderer destroyed; suspending persistent WebContentsView", {
      id: entry.id,
      persistKey: entry.persistKey,
      alreadySuspended: entry.suspended,
    });
    entry.ownerWebContentsDestroyed = true;

    if (!entry.suspended) {
      const win = BrowserWindow.fromId(entry.ownerWindowId);
      if (win && !win.isDestroyed()) {
        try {
          win.contentView.removeChildView(entry.view);
        } catch {
          // ignore removal failures
        }
      }
      try {
        entry.view.setVisible(false);
      } catch {
        // ignore visibility toggles on unsupported platforms
      }
      markSuspended(entry);
      suspendedAny = true;
    }
  }

  if (suspendedAny) {
    logger.log("Suspended WebContentsViews after renderer destroyed", {
      windowId,
      webContentsId,
      suspendedCount,
    });
    evictExcessSuspended(logger);
  }
}

function destroyView(id: number): boolean {
  const entry = viewEntries.get(id);
  if (!entry) return false;
  try {
    removeFromSuspended(entry);
    const win = BrowserWindow.fromId(entry.ownerWindowId);
    if (win && !win.isDestroyed()) {
      try {
        win.contentView.removeChildView(entry.view);
      } catch {
        // ignore removal failures
      }
    }
    try {
      destroyWebContents(entry.view.webContents);
    } catch {
      // ignore destroy failures
    }
  } finally {
    viewEntries.delete(id);
  }
  return true;
}

function toBounds(bounds: Rectangle | undefined): Rectangle {
  if (!bounds) return { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: Math.round(bounds.x ?? 0),
    y: Math.round(bounds.y ?? 0),
    width: Math.max(0, Math.round(bounds.width ?? 0)),
    height: Math.max(0, Math.round(bounds.height ?? 0)),
  };
}

function evaluateVisibility(bounds: Rectangle, explicit?: boolean): boolean {
  if (typeof explicit === "boolean") return explicit;
  return bounds.width > 0 && bounds.height > 0;
}

function applyBackgroundColor(view: Electron.WebContentsView, color: string | undefined) {
  if (!color) return;
  try {
    view.setBackgroundColor(color);
  } catch {
    // ignore invalid colors
  }
}

function applyBorderRadius(view: Electron.WebContentsView, radius: number | undefined) {
  if (typeof radius !== "number" || Number.isNaN(radius)) return;
  const safe = Math.max(0, Math.round(radius));
  try {
    view.setBorderRadius(safe);
  } catch {
    // ignore unsupported platforms
  }
}

function destroyWebContents(contents: WebContents) {
  const destroyable = contents as WebContents & {
    destroy?: () => void;
    close?: () => void;
  };
  if (typeof destroyable.destroy === "function") {
    destroyable.destroy();
  } else if (typeof destroyable.close === "function") {
    destroyable.close();
  }
}

export function registerWebContentsViewHandlers({
  logger,
  maxSuspendedEntries: providedMax,
}: RegisterOptions): void {
  setMaxSuspendedEntries(providedMax);

  ipcMain.handle("cmux:webcontents:create", async (event, rawOptions: CreateOptions) => {
    try {
      const sender = event.sender;
      const win = BrowserWindow.fromWebContents(sender);
      if (!win) {
        logger.warn("webcontents-view:create with no owning window");
        throw new Error("No owning window for web contents view");
      }

      const options = rawOptions ?? { url: "about:blank" };
      const persistKey =
        typeof options.persistKey === "string" && options.persistKey.trim().length > 0
          ? options.persistKey.trim()
          : undefined;

      const bounds = toBounds(options.bounds);
      const desiredVisibility = evaluateVisibility(bounds);

      if (persistKey) {
        const candidate = suspendedByKey.get(persistKey);
        const sameWindow = candidate?.ownerWindowId === win.id;
        const sameSender = candidate?.ownerWebContentsId === sender.id;
        const canAdopt = candidate?.ownerWebContentsDestroyed === true;
        if (candidate && sameWindow && (sameSender || canAdopt)) {
          removeFromSuspended(candidate);
          try {
            win.contentView.addChildView(candidate.view);
          } catch (error) {
            logger.error("Failed to reattach suspended WebContentsView", error);
            destroyView(candidate.id);
            throw error;
          }

          applyChromeCamouflage(candidate.view, logger);

          try {
            candidate.view.setBounds(bounds);
            candidate.view.setVisible(desiredVisibility);
          } catch (error) {
            logger.warn("Failed to update bounds for restored WebContentsView", {
              error,
              id: candidate.id,
            });
          }

          if (options.backgroundColor !== undefined) {
            applyBackgroundColor(candidate.view, options.backgroundColor);
          }
          if (options.borderRadius !== undefined) {
            applyBorderRadius(candidate.view, options.borderRadius);
          }

          candidate.ownerWindowId = win.id;
          candidate.ownerWebContentsId = sender.id;
          candidate.ownerWebContentsDestroyed = false;

          logger.log("Reattached WebContentsView", {
            id: candidate.id,
            persistKey,
            windowId: win.id,
            senderId: sender.id,
          });

          if (!windowCleanupRegistered.has(win.id)) {
            windowCleanupRegistered.add(win.id);
            win.once("closed", () => {
              cleanupViewsForWindow(win.id);
              windowCleanupRegistered.delete(win.id);
            });
          }

          const senderId = sender.id;
          sender.once("destroyed", () => {
            suspendEntriesForDestroyedOwner(win.id, senderId, logger);
          });

          return { id: candidate.id, webContentsId: candidate.view.webContents.id, restored: true };
        }
      }

      const view = new WebContentsView();

      applyChromeCamouflage(view, logger);

      applyBackgroundColor(view, options.backgroundColor);
      applyBorderRadius(view, options.borderRadius);

      try {
        win.contentView.addChildView(view);
      } catch (error) {
        logger.error("Failed to add WebContentsView to window", error);
        try {
          destroyWebContents(view.webContents);
        } catch {
          // ignore
        }
        throw error;
      }

      try {
        view.setBounds(bounds);
        view.setVisible(desiredVisibility);
      } catch (error) {
        logger.warn("Failed to set initial bounds for WebContentsView", error);
      }

      const finalUrl = options.url ?? "about:blank";
      void view.webContents
        .loadURL(finalUrl)
        .catch((error) =>
          logger.warn("WebContentsView initial load failed", { url: finalUrl, error })
        );

      const id = nextViewId++;
      const entry: Entry = {
        id,
        view,
        ownerWindowId: win.id,
        ownerWebContentsId: sender.id,
        persistKey,
        suspended: false,
        ownerWebContentsDestroyed: false,
      };
      viewEntries.set(id, entry);

      if (!windowCleanupRegistered.has(win.id)) {
        windowCleanupRegistered.add(win.id);
        win.once("closed", () => {
          cleanupViewsForWindow(win.id);
          windowCleanupRegistered.delete(win.id);
        });
      }

      const senderId = sender.id;
      sender.once("destroyed", () => {
        suspendEntriesForDestroyedOwner(win.id, senderId, logger);
      });

      logger.log("Created WebContentsView", {
        id,
        windowId: win.id,
        senderId: sender.id,
        url: finalUrl,
        persistKey,
      });

      return { id, webContentsId: view.webContents.id, restored: false };
    } catch (error) {
      logger.error("webcontents-view:create failed", error);
      throw error;
    }
  });

  ipcMain.handle("cmux:webcontents:set-bounds", (event, payload: SetBoundsOptions) => {
    const { id, bounds: rawBounds, visible } = payload ?? {};
    if (typeof id !== "number") return { ok: false };

    const entry = viewEntries.get(id);
    if (!entry) return { ok: false };
    if (event.sender.id !== entry.ownerWebContentsId) {
      return { ok: false };
    }

    const bounds = toBounds(rawBounds);
    try {
      entry.view.setBounds(bounds);
      entry.view.setVisible(evaluateVisibility(bounds, visible));
      return { ok: true };
    } catch (error) {
      entry.view.setVisible(false);
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle("cmux:webcontents:load-url", (event, options: LoadUrlOptions) => {
    const { id, url } = options ?? {};
    if (typeof id !== "number" || typeof url !== "string" || url.length === 0) {
      return { ok: false };
    }
    const entry = viewEntries.get(id);
    if (!entry) return { ok: false };
    if (event.sender.id !== entry.ownerWebContentsId) {
      return { ok: false };
    }
    try {
      void entry.view.webContents.loadURL(url);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle("cmux:webcontents:release", (event, options: ReleaseOptions) => {
    const { id, persist } = options ?? {};
    if (typeof id !== "number") return { ok: false };
    const entry = viewEntries.get(id);
    if (!entry) return { ok: false };
    if (event.sender.id !== entry.ownerWebContentsId) {
      return { ok: false };
    }

    const shouldPersist = Boolean(persist) && typeof entry.persistKey === "string";
    if (!shouldPersist) {
      const ok = destroyView(id);
      logger.log("Destroyed WebContentsView", {
        id,
        persistKey: entry.persistKey,
        reason: "release-without-persist",
      });
      return { ok, suspended: false };
    }

    if (entry.suspended) {
      logger.log("Release skipped; already suspended", {
        id,
        persistKey: entry.persistKey,
      });
      return { ok: true, suspended: true };
    }

    const win = BrowserWindow.fromId(entry.ownerWindowId);
    if (win && !win.isDestroyed()) {
      try {
        win.contentView.removeChildView(entry.view);
      } catch {
        // ignore
      }
    }

    try {
      entry.view.setVisible(false);
    } catch {
      // ignore
    }

    entry.ownerWebContentsDestroyed = false;
    markSuspended(entry);

    logger.log("Suspended WebContentsView", {
      id,
      persistKey: entry.persistKey,
      suspendedCount,
    });

    evictExcessSuspended(logger);

    return { ok: true, suspended: true };
  });

  ipcMain.handle("cmux:webcontents:destroy", (event, id: number) => {
    if (typeof id !== "number") return { ok: false };
    const entry = viewEntries.get(id);
    if (!entry) return { ok: false };
    if (event.sender.id !== entry.ownerWebContentsId) {
      return { ok: false };
    }
    const ok = destroyView(id);
    logger.log("Destroyed WebContentsView", {
      id,
      persistKey: entry.persistKey,
      reason: "explicit-destroy",
    });
    return { ok };
  });

  ipcMain.handle("cmux:webcontents:update-style", (event, options: UpdateStyleOptions) => {
    const { id, backgroundColor, borderRadius } = options ?? {};
    if (typeof id !== "number") return { ok: false };
    const entry = viewEntries.get(id);
    if (!entry) return { ok: false };
    if (event.sender.id !== entry.ownerWebContentsId) {
      return { ok: false };
    }
    applyBackgroundColor(entry.view, backgroundColor);
    applyBorderRadius(entry.view, borderRadius);
    return { ok: true };
  });
}
