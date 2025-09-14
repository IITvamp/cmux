import { BrowserWindow, WebContentsView, ipcMain } from "electron";

type Bounds = { x: number; y: number; width: number; height: number };

type ViewRecord = {
  id: number;
  view: WebContentsView;
  attached: boolean;
  destroyed: boolean;
};

const views = new Map<number, ViewRecord>();
let nextId = 1;

function emit(id: number, payload: unknown): void {
  try {
    // Broadcast to all webContents in case multiple renderers are listening
    const all = BrowserWindow.getAllWindows();
    for (const win of all) {
      if (!win.isDestroyed()) {
        win.webContents.send(`wcv:event:${id}`, payload);
      }
    }
  } catch {
    // ignore
  }
}

function navStatePayload(view: WebContentsView) {
  const wc = view.webContents;
  return {
    type: "nav-state" as const,
    url: wc.getURL(),
    title: wc.getTitle(),
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
  };
}

export function registerWcvIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle("wcv:create", () => {
    const id = nextId++;
    const win = getWindow();
    if (!win) throw new Error("No BrowserWindow available");

    const view = new WebContentsView({
      webPreferences: {
        // Match the main window's session so cookies/auth carry over
        partition: win.webContents.getWebPreferences().partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const rec: ViewRecord = { id, view, attached: false, destroyed: false };
    views.set(id, rec);

    const wc = view.webContents;

    wc.on("did-start-loading", () => emit(id, { type: "loading", loading: true }));
    wc.on("did-stop-loading", () => emit(id, { type: "loading", loading: false }));
    wc.on("page-title-updated", () => emit(id, navStatePayload(view)));
    wc.on("did-navigate", () => emit(id, navStatePayload(view)));
    wc.on("did-navigate-in-page", () => emit(id, navStatePayload(view)));
    wc.on("did-fail-load", (_e, code, desc, url) =>
      emit(id, { type: "load-failed", code, desc, url })
    );
    wc.on("did-finish-load", () => emit(id, { type: "did-finish-load" }));

    return { id } as const;
  });

  ipcMain.handle("wcv:destroy", (_e, id: number) => {
    const rec = views.get(id);
    if (!rec || rec.destroyed) return { ok: false } as const;
    const win = getWindow();
    try {
      if (rec.attached && win && !win.isDestroyed()) {
        try {
          win.contentView.removeChildView(rec.view);
        } catch {
          // ignore
        }
      }
      if (!rec.view.webContents.isDestroyed()) {
        rec.view.webContents.destroy();
      }
    } finally {
      rec.attached = false;
      rec.destroyed = true;
      views.delete(id);
    }
    return { ok: true } as const;
  });

  ipcMain.handle("wcv:attach", (_e, id: number) => {
    const rec = views.get(id);
    const win = getWindow();
    if (!rec || !win) return { ok: false } as const;
    if (!rec.attached) {
      win.contentView.addChildView(rec.view);
      rec.attached = true;
    }
    return { ok: true } as const;
  });

  ipcMain.handle("wcv:detach", (_e, id: number) => {
    const rec = views.get(id);
    const win = getWindow();
    if (!rec || !win) return { ok: false } as const;
    if (rec.attached) {
      try {
        win.contentView.removeChildView(rec.view);
      } catch {
        // ignore
      }
      rec.attached = false;
    }
    return { ok: true } as const;
  });

  ipcMain.handle("wcv:set-bounds", (_e, id: number, bounds: Bounds) => {
    const rec = views.get(id);
    if (!rec) return { ok: false } as const;
    rec.view.setBounds(bounds);
    return { ok: true } as const;
  });

  ipcMain.handle("wcv:load-url", async (_e, id: number, url: string) => {
    const rec = views.get(id);
    if (!rec) return { ok: false } as const;
    await rec.view.webContents.loadURL(url);
    return { ok: true } as const;
  });

  ipcMain.handle("wcv:reload", (_e, id: number) => {
    const rec = views.get(id);
    if (!rec) return { ok: false } as const;
    rec.view.webContents.reload();
    return { ok: true } as const;
  });

  ipcMain.handle("wcv:go-back", (_e, id: number) => {
    const rec = views.get(id);
    if (!rec) return { ok: false } as const;
    if (rec.view.webContents.canGoBack()) rec.view.webContents.goBack();
    return { ok: true } as const;
  });

  ipcMain.handle("wcv:go-forward", (_e, id: number) => {
    const rec = views.get(id);
    if (!rec) return { ok: false } as const;
    if (rec.view.webContents.canGoForward()) rec.view.webContents.goForward();
    return { ok: true } as const;
  });

  ipcMain.handle("wcv:open-devtools", (_e, id: number) => {
    const rec = views.get(id);
    if (!rec) return { ok: false } as const;
    rec.view.webContents.openDevTools({ mode: "detach" });
    return { ok: true } as const;
  });

  ipcMain.handle("wcv:close-devtools", (_e, id: number) => {
    const rec = views.get(id);
    if (!rec) return { ok: false } as const;
    rec.view.webContents.closeDevTools();
    return { ok: true } as const;
  });

  ipcMain.handle("wcv:focus", (_e, id: number) => {
    const rec = views.get(id);
    if (!rec) return { ok: false } as const;
    rec.view.webContents.focus();
    return { ok: true } as const;
  });
}

