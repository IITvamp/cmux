import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, net, protocol, shell } from "electron";
import path, { join } from "node:path";
import { pathToFileURL } from "node:url";

// Register the custom cmux:// scheme with appropriate privileges so it behaves
// like a standard, secure scheme (allows cookies, fetch, etc.). Must occur
// before the app is ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "cmux",
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let rendererLoaded = false;
let pendingProtocolUrl: string | null = null;

type LogLevel = "info" | "warn" | "error" | "debug";
function sendMainLog(level: LogLevel, ...args: unknown[]): void {
  try {
    mainWindow?.webContents.send("main-log", { level, args });
  } catch {
    // ignore
  }
}
function mainLog(level: LogLevel, ...args: unknown[]): void {
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(...args);
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(...args);
  } else if (level === "debug") {
    // eslint-disable-next-line no-console
    console.debug(...args);
  } else {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
  sendMainLog(level, ...args);
}

function handleOrQueueProtocolUrl(url: string): void {
  if (mainWindow && rendererLoaded) {
    handleProtocolUrl(url);
  } else {
    pendingProtocolUrl = url;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 10 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  // Once the renderer is loaded, process any queued deep-link
  mainWindow.webContents.on("did-finish-load", () => {
    rendererLoaded = true;
    if (pendingProtocolUrl) {
      handleProtocolUrl(pendingProtocolUrl);
      pendingProtocolUrl = null;
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    // In production, serve the renderer over our custom protocol so
    // cookies and other web storage work (file:// does not support cookies).
    mainWindow.loadURL("cmux://local/index.html");
  }
}

app.on("open-url", (_event, url) => {
  mainLog("info", "Received open-url", url);
  handleOrQueueProtocolUrl(url);
});

app.whenReady().then(() => {
  createWindow();
  // When packaged, electron-vite outputs the renderer to out/renderer
  // which is bundled inside app.asar (referenced by app.getAppPath()).
  const baseDir = path.join(app.getAppPath(), "out", "renderer");

  // Serve local renderer files under cmux://local/, enabling cookies.
  protocol.handle("cmux", async (req) => {
    const { host, pathname } = new URL(req.url);
    // Accept both cmux://local/... and cmux:///... (no host) for flexibility
    if (host && host !== "local")
      return new Response("not found", { status: 404 });

    const fsPath = path.normalize(path.join(baseDir, pathname));
    const rel = path.relative(baseDir, fsPath);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
      return new Response("bad path", { status: 400 });
    }

    // Let Electron handle file:// reading via net.fetch for correct mime types
    return net.fetch(pathToFileURL(fsPath).toString());
  });

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function handleProtocolUrl(url: string): void {
  if (!mainWindow) {
    // Should not happen due to queuing, but guard anyway
    pendingProtocolUrl = url;
    return;
  }

  const urlObj = new URL(url);

  if (urlObj.hostname === "auth-callback") {
    mainLog("info", "Handling auth-callback", url);
    // Check for the full URL parameter
    const stackRefresh = urlObj.searchParams.get(`stack_refresh`);
    const stackAccess = urlObj.searchParams.get("stack_access");

    if (stackRefresh && stackAccess) {
      // Determine a cookieable URL. Prefer our custom cmux:// origin when not
      // running against an http(s) dev server.
      const currentUrl = mainWindow.webContents.getURL();

      mainLog("info", "Attempting to set cookies on", currentUrl);
      mainWindow.webContents.session.cookies
        .set({
          url: currentUrl,
          name: `stack-refresh-8a877114-b905-47c5-8b64-3a2d90679577`,
          value: stackRefresh,
          path: "/",
        })
        .then(() =>
          mainLog(
            "info",
            "Set cookie",
            `stack-refresh-8a877114-b905-47c5-8b64-3a2d90679577`
          )
        )
        .catch((e) => mainLog("error", "Failed to set refresh cookie", e));

      mainWindow.webContents.session.cookies
        .set({
          url: currentUrl,
          name: "stack-access",
          value: stackAccess,
          path: "/",
        })
        .then(() => mainLog("info", "Set cookie", "stack-access"))
        .catch((e) => mainLog("error", "Failed to set access cookie", e));

      mainWindow.webContents.session.cookies
        .get({ url: currentUrl })
        .then((cookies) => mainLog("debug", "Cookies for", currentUrl, cookies))
        .catch((e) => mainLog("error", "Failed to read cookies", e));

      mainWindow.webContents.send("auth-callback", {
        stackRefresh,
        stackAccess,
      });
    }
  }
}
