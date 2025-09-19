import {
  BrowserWindow,
  WebContentsView,
  ipcMain,
  webContents,
  type Rectangle,
  type WebContents,
} from "electron";

interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

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
  removeListeners?: () => void;
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
    entry.removeListeners?.();
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

          if (!candidate.removeListeners) {
            candidate.removeListeners = attachWebContentsObservers(candidate, logger);
          }

          sendWebContentsSnapshot(candidate, "reattach");

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

          return {
            id: candidate.id,
            webContentsId: candidate.view.webContents.id,
            restored: true,
            url: safeGetUrl(candidate.view.webContents) ?? undefined,
            title: safeGetTitle(candidate.view.webContents) ?? undefined,
            isLoading: candidate.view.webContents.isLoading(),
          };
        }
      }

      const view = new WebContentsView();

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

      entry.removeListeners = attachWebContentsObservers(entry, logger);

      const finalUrl = options.url ?? "about:blank";
      void view.webContents
        .loadURL(finalUrl)
        .catch((error) =>
          logger.warn("WebContentsView initial load failed", { url: finalUrl, error })
        );

      sendWebContentsSnapshot(entry, "create", finalUrl);

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

      return {
        id,
        webContentsId: view.webContents.id,
        restored: false,
        url: finalUrl,
        title: safeGetTitle(view.webContents) ?? undefined,
        isLoading: view.webContents.isLoading(),
      };
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
      sendWebContentsSnapshot(entry, "load", url);
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

  ipcMain.handle(
    "cmux:webcontents:get-state",
    (event, options: { id?: number; persistKey?: string } | undefined) => {
      const entry = resolveEntryForRequest(event.sender.id, options ?? {});
      if (!entry) {
        return { ok: false };
      }

      try {
        const contents = entry.view.webContents;
        return {
          ok: true,
          state: {
            url: safeGetUrl(contents) ?? null,
            title: safeGetTitle(contents) ?? null,
            isLoading: contents.isLoading(),
            canGoBack: contents.canGoBack(),
            canGoForward: contents.canGoForward(),
          },
        };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    "cmux:webcontents:open-devtools",
    (
      event,
      options:
        | { id?: number; persistKey?: string; mode?: "right" | "bottom" | "left" | "detach" | "undocked" }
        | undefined
    ) => {
      const entry = resolveEntryForRequest(event.sender.id, options ?? {});
      if (!entry) {
        return { ok: false };
      }

      try {
        const mode = options?.mode;
        if (mode) {
          entry.view.webContents.openDevTools({ mode });
        } else {
          entry.view.webContents.openDevTools({ mode: "detach" });
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    }
  );
}

type WebContentsEventType =
  | "did-attach"
  | "did-start-loading"
  | "did-stop-loading"
  | "did-finish-load"
  | "did-fail-load"
  | "did-navigate"
  | "did-navigate-in-page"
  | "page-title-updated";

interface WebContentsBridgeEvent {
  type: WebContentsEventType;
  url?: string;
  title?: string;
  isLoading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  httpResponseCode?: number;
  httpStatusText?: string;
  errorCode?: number;
  errorDescription?: string;
  validatedURL?: string;
  isMainFrame?: boolean;
}

function resolveEntryForRequest(
  senderId: number,
  options: { id?: number; persistKey?: string }
): Entry | null {
  if (typeof options.id === "number") {
    const entry = viewEntries.get(options.id) ?? null;
    if (!entry) return null;
    if (entry.ownerWebContentsId !== senderId && !entry.ownerWebContentsDestroyed) {
      return null;
    }
    return entry;
  }

  const persistKey =
    typeof options.persistKey === "string" && options.persistKey.trim().length > 0
      ? options.persistKey.trim()
      : undefined;
  if (!persistKey) {
    return null;
  }

  for (const entry of viewEntries.values()) {
    if (entry.persistKey === persistKey) {
      if (entry.ownerWebContentsId === senderId || entry.ownerWebContentsDestroyed) {
        return entry;
      }
    }
  }
  return null;
}

function emitWebContentsEvent(entry: Entry, payload: WebContentsBridgeEvent) {
  const owner = webContents.fromId(entry.ownerWebContentsId);
  if (!owner || owner.isDestroyed()) {
    return;
  }
  owner.send("cmux:webcontents:event", {
    id: entry.id,
    persistKey: entry.persistKey,
    ...payload,
  });
}

function safeGetUrl(contents: WebContents): string | null {
  try {
    const url = contents.getURL();
    return typeof url === "string" ? url : null;
  } catch {
    return null;
  }
}

function safeGetTitle(contents: WebContents): string | null {
  try {
    const title = contents.getTitle();
    return typeof title === "string" ? title : null;
  } catch {
    return null;
  }
}

function sendWebContentsSnapshot(entry: Entry, reason: "create" | "reattach" | "load", pendingUrl?: string) {
  const contents = entry.view.webContents;
  const currentUrl = safeGetUrl(contents);
  emitWebContentsEvent(entry, {
    type: "did-attach",
    url: currentUrl ?? pendingUrl,
    title: safeGetTitle(contents) ?? undefined,
    isLoading: contents.isLoading(),
    canGoBack: contents.canGoBack(),
    canGoForward: contents.canGoForward(),
  });
}

function attachWebContentsObservers(entry: Entry, logger: Logger): () => void {
  const { view } = entry;
  const contents = view.webContents;
  const disposers: Array<() => void> = [];

  const handleDidStartLoading = () => {
    emitWebContentsEvent(entry, {
      type: "did-start-loading",
      url: safeGetUrl(contents) ?? undefined,
    });
  };
  contents.on("did-start-loading", handleDidStartLoading);
  disposers.push(() => contents.removeListener("did-start-loading", handleDidStartLoading));

  const handleDidStopLoading = () => {
    emitWebContentsEvent(entry, {
      type: "did-stop-loading",
      url: safeGetUrl(contents) ?? undefined,
      isLoading: contents.isLoading(),
      canGoBack: contents.canGoBack(),
      canGoForward: contents.canGoForward(),
    });
  };
  contents.on("did-stop-loading", handleDidStopLoading);
  disposers.push(() => contents.removeListener("did-stop-loading", handleDidStopLoading));

  const handleDidFinishLoad = () => {
    emitWebContentsEvent(entry, {
      type: "did-finish-load",
      url: safeGetUrl(contents) ?? undefined,
      canGoBack: contents.canGoBack(),
      canGoForward: contents.canGoForward(),
    });
  };
  contents.on("did-finish-load", handleDidFinishLoad);
  disposers.push(() => contents.removeListener("did-finish-load", handleDidFinishLoad));

  const handleDidFailLoad = (
    _event: Electron.Event,
    errorCode: number,
    errorDescription: string,
    validatedURL: string,
    isMainFrame: boolean
  ) => {
    emitWebContentsEvent(entry, {
      type: "did-fail-load",
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame,
    });
  };
  contents.on("did-fail-load", handleDidFailLoad);
  disposers.push(() => contents.removeListener("did-fail-load", handleDidFailLoad));

  const handleDidNavigate = (
    _event: Electron.Event,
    url: string,
    httpResponseCode: number,
    httpStatusText: string
  ) => {
    emitWebContentsEvent(entry, {
      type: "did-navigate",
      url,
      title: safeGetTitle(contents) ?? undefined,
      httpResponseCode,
      httpStatusText,
      canGoBack: contents.canGoBack(),
      canGoForward: contents.canGoForward(),
    });
  };
  contents.on("did-navigate", handleDidNavigate);
  disposers.push(() => contents.removeListener("did-navigate", handleDidNavigate));

  const handleDidNavigateInPage = (
    _event: Electron.Event,
    url: string,
    isMainFrame: boolean
  ) => {
    emitWebContentsEvent(entry, {
      type: "did-navigate-in-page",
      url,
      isMainFrame,
      canGoBack: contents.canGoBack(),
      canGoForward: contents.canGoForward(),
    });
  };
  contents.on("did-navigate-in-page", handleDidNavigateInPage);
  disposers.push(() => contents.removeListener("did-navigate-in-page", handleDidNavigateInPage));

  const handlePageTitleUpdated = (
    _event: Electron.Event,
    title: string
  ) => {
    emitWebContentsEvent(entry, {
      type: "page-title-updated",
      title,
      url: safeGetUrl(contents) ?? undefined,
    });
  };
  contents.on("page-title-updated", handlePageTitleUpdated);
  disposers.push(() => contents.removeListener("page-title-updated", handlePageTitleUpdated));

  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch (error) {
        logger.warn("Failed to dispose WebContentsView listener", error);
      }
    }
  };
}
