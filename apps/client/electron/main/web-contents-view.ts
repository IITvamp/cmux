import { BrowserWindow, WebContentsView, ipcMain, type Rectangle, type WebContents } from "electron";

interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

interface RegisterOptions {
  logger: Logger;
}

interface CreateOptions {
  url: string;
  bounds?: Rectangle;
  backgroundColor?: string;
  borderRadius?: number;
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

interface Entry {
  view: Electron.WebContentsView;
  ownerWindowId: number;
  ownerWebContentsId: number;
}

const viewEntries = new Map<number, Entry>();
let nextViewId = 1;
const windowCleanupRegistered = new Set<number>();

function cleanupViewsForWindow(windowId: number) {
  for (const [id, entry] of Array.from(viewEntries.entries())) {
    if (entry.ownerWindowId === windowId) {
      destroyView(id);
    }
  }
}

function destroyView(id: number): boolean {
  const entry = viewEntries.get(id);
  if (!entry) return false;
  try {
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

export function registerWebContentsViewHandlers({ logger }: RegisterOptions): void {
  ipcMain.handle("cmux:webcontents:create", async (event, rawOptions: CreateOptions) => {
    try {
      const sender = event.sender;
      const win = BrowserWindow.fromWebContents(sender);
      if (!win) {
        logger.warn("webcontents-view:create with no owning window");
        throw new Error("No owning window for web contents view");
      }

      const options = rawOptions ?? { url: "about:blank" };
      const view = new WebContentsView();

      applyBackgroundColor(view, options.backgroundColor);
      applyBorderRadius(view, options.borderRadius);

      const bounds = toBounds(options.bounds);

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
        view.setVisible(evaluateVisibility(bounds));
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
      viewEntries.set(id, {
        view,
        ownerWindowId: win.id,
        ownerWebContentsId: sender.id,
      });

      if (!windowCleanupRegistered.has(win.id)) {
        windowCleanupRegistered.add(win.id);
        win.once("closed", () => {
          cleanupViewsForWindow(win.id);
          windowCleanupRegistered.delete(win.id);
        });
      }

      sender.once("destroyed", () => {
        cleanupViewsForWindow(win.id);
      });

      logger.log("Created WebContentsView", {
        id,
        windowId: win.id,
        senderId: sender.id,
        url: finalUrl,
      });

      return { id, webContentsId: view.webContents.id };
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

  ipcMain.handle("cmux:webcontents:destroy", (event, id: number) => {
    if (typeof id !== "number") return { ok: false };
    const entry = viewEntries.get(id);
    if (!entry) return { ok: false };
    if (event.sender.id !== entry.ownerWebContentsId) {
      return { ok: false };
    }
    const ok = destroyView(id);
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
