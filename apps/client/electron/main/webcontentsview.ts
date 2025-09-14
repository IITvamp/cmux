import { BrowserWindow, ipcMain, WebContentsView, type WebContents } from "electron";

interface WebContentsViewInfo {
  view: WebContentsView;
  parentWindow: BrowserWindow;
}

const webContentsViews = new Map<number, WebContentsViewInfo>();
let nextViewId = 1;

export function initWebContentsViewHandlers(mainWindow: BrowserWindow): void {
  // Create a new WebContentsView
  ipcMain.handle("wcv:create", async (_event, options: {
    url?: string;
    bounds?: { x: number; y: number; width: number; height: number };
    autoResize?: boolean;
    visible?: boolean;
    backgroundColor?: string;
    preload?: string;
  }) => {
    const viewId = nextViewId++;
    
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        preload: options.preload,
      },
    });

    // Set initial bounds if provided
    if (options.bounds) {
      view.setBounds(options.bounds);
    }

    // Set background color if provided
    if (options.backgroundColor) {
      view.setBackgroundColor(options.backgroundColor);
    }

    // Add to window
    mainWindow.contentView.addChildView(view);

    // Set visibility
    if (options.visible !== undefined) {
      view.setVisible(options.visible);
    }

    // Store the view
    webContentsViews.set(viewId, { view, parentWindow: mainWindow });

    // Set up event forwarding
    const webContents = view.webContents;
    
    // Forward navigation events
    webContents.on("did-navigate", () => {
      mainWindow.webContents.send(`wcv:did-navigate:${viewId}`);
    });

    webContents.on("did-navigate-in-page", () => {
      mainWindow.webContents.send(`wcv:did-navigate:${viewId}`);
    });

    // Forward loading events
    webContents.on("did-start-loading", () => {
      mainWindow.webContents.send(`wcv:did-start-loading:${viewId}`);
    });

    webContents.on("did-stop-loading", () => {
      mainWindow.webContents.send(`wcv:did-stop-loading:${viewId}`);
    });

    webContents.on("did-fail-load", (_event, _errorCode, errorDescription) => {
      mainWindow.webContents.send(`wcv:did-fail-load:${viewId}`, errorDescription);
    });

    // Forward title updates
    webContents.on("page-title-updated", (_event, title) => {
      mainWindow.webContents.send(`wcv:page-title-updated:${viewId}`, title);
    });

    // Load initial URL if provided
    if (options.url) {
      await view.webContents.loadURL(options.url);
    }

    return viewId;
  });

  // Destroy a WebContentsView
  ipcMain.handle("wcv:destroy", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return;

    // Remove from parent window
    info.parentWindow.contentView.removeChildView(info.view);
    
    // Clean up
    (info.view.webContents as WebContents & { destroy?: () => void }).destroy?.();
    webContentsViews.delete(id);
  });

  // Set bounds
  ipcMain.handle("wcv:setBounds", async (_event, id: number, bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    info.view.setBounds(bounds);
  });

  // Set visibility
  ipcMain.handle("wcv:setVisible", async (_event, id: number, visible: boolean) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    info.view.setVisible(visible);
  });

  // Load URL
  ipcMain.handle("wcv:loadURL", async (_event, id: number, url: string) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    await info.view.webContents.loadURL(url);
  });

  // Reload
  ipcMain.handle("wcv:reload", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    info.view.webContents.reload();
  });

  // Navigation
  ipcMain.handle("wcv:goBack", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    info.view.webContents.goBack();
  });

  ipcMain.handle("wcv:goForward", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    info.view.webContents.goForward();
  });

  // Execute JavaScript
  ipcMain.handle("wcv:executeJavaScript", async (_event, id: number, code: string) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    return await info.view.webContents.executeJavaScript(code);
  });

  // Insert CSS
  ipcMain.handle("wcv:insertCSS", async (_event, id: number, css: string) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    await info.view.webContents.insertCSS(css);
  });

  // Focus/Blur
  ipcMain.handle("wcv:focus", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    info.view.webContents.focus();
  });

  ipcMain.handle("wcv:blur", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    // Note: blur() method might not be available on webContents
    // Focus another element instead or ignore
    info.parentWindow.focus();
  });

  // Navigation state
  ipcMain.handle("wcv:canGoBack", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return false;
    return info.view.webContents.canGoBack();
  });

  ipcMain.handle("wcv:canGoForward", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return false;
    return info.view.webContents.canGoForward();
  });

  // Get properties
  ipcMain.handle("wcv:getURL", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return "";
    return info.view.webContents.getURL();
  });

  ipcMain.handle("wcv:getTitle", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return "";
    return info.view.webContents.getTitle();
  });

  ipcMain.handle("wcv:isLoading", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return false;
    return info.view.webContents.isLoading();
  });

  // Stop loading
  ipcMain.handle("wcv:stop", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    info.view.webContents.stop();
  });

  // DevTools
  ipcMain.handle("wcv:openDevTools", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    info.view.webContents.openDevTools();
  });

  ipcMain.handle("wcv:closeDevTools", async (_event, id: number) => {
    const info = webContentsViews.get(id);
    if (!info) return;
    info.view.webContents.closeDevTools();
  });
}

// Clean up all views when app is closing
export function cleanupWebContentsViews(): void {
  for (const [id, info] of webContentsViews.entries()) {
    try {
      info.parentWindow.contentView.removeChildView(info.view);
      (info.view.webContents as WebContents & { destroy?: () => void }).destroy?.();
    } catch (error) {
      console.error(`Failed to cleanup WebContentsView ${id}:`, error);
    }
  }
  webContentsViews.clear();
}