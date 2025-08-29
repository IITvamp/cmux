import { app, protocol, net, BrowserWindow, shell } from "electron";
import path, { join } from "node:path";
import { pathToFileURL } from "node:url";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const is = {
  dev: !app.isPackaged
};
({
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
});
protocol.registerSchemesAsPrivileged([
  {
    scheme: "cmux",
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true
    }
  }
]);
let mainWindow = null;
let rendererLoaded = false;
let pendingProtocolUrl = null;
function sendMainLog(level, ...args) {
  try {
    mainWindow?.webContents.send("main-log", { level, args });
  } catch {
  }
}
function mainLog(level, ...args) {
  if (level === "error") {
    console.error(...args);
  } else if (level === "warn") {
    console.warn(...args);
  } else if (level === "debug") {
    console.debug(...args);
  } else {
    console.log(...args);
  }
  sendMainLog(level, ...args);
}
function handleOrQueueProtocolUrl(url) {
  if (mainWindow && rendererLoaded) {
    handleProtocolUrl(url);
  } else {
    pendingProtocolUrl = url;
  }
}
function createWindow() {
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
      nodeIntegration: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
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
    mainWindow.loadURL("cmux://local/index.html");
  }
}
app.on("open-url", (_event, url) => {
  mainLog("info", "Received open-url", url);
  handleOrQueueProtocolUrl(url);
});
app.whenReady().then(() => {
  createWindow();
  const baseDir = path.join(app.getAppPath(), "out", "renderer");
  protocol.handle("cmux", async (req) => {
    const { host, pathname } = new URL(req.url);
    if (host && host !== "local")
      return new Response("not found", { status: 404 });
    const fsPath = path.normalize(path.join(baseDir, pathname));
    const rel = path.relative(baseDir, fsPath);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
      return new Response("bad path", { status: 400 });
    }
    return net.fetch(pathToFileURL(fsPath).toString());
  });
  app.on("activate", function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
function handleProtocolUrl(url) {
  if (!mainWindow) {
    pendingProtocolUrl = url;
    return;
  }
  const urlObj = new URL(url);
  if (urlObj.hostname === "auth-callback") {
    mainLog("info", "Handling auth-callback", url);
    const stackRefresh = urlObj.searchParams.get(`stack_refresh`);
    const stackAccess = urlObj.searchParams.get("stack_access");
    if (stackRefresh && stackAccess) {
      const currentUrl = mainWindow.webContents.getURL();
      mainLog("info", "Attempting to set cookies on", currentUrl);
      mainWindow.webContents.session.cookies.set({
        url: currentUrl,
        name: `stack-refresh-8a877114-b905-47c5-8b64-3a2d90679577`,
        value: stackRefresh,
        path: "/"
      }).then(
        () => mainLog(
          "info",
          "Set cookie",
          `stack-refresh-8a877114-b905-47c5-8b64-3a2d90679577`
        )
      ).catch((e) => mainLog("error", "Failed to set refresh cookie", e));
      mainWindow.webContents.session.cookies.set({
        url: currentUrl,
        name: "stack-access",
        value: stackAccess,
        path: "/"
      }).then(() => mainLog("info", "Set cookie", "stack-access")).catch((e) => mainLog("error", "Failed to set access cookie", e));
      mainWindow.webContents.session.cookies.get({ url: currentUrl }).then((cookies) => mainLog("debug", "Cookies for", currentUrl, cookies)).catch((e) => mainLog("error", "Failed to read cookies", e));
      mainWindow.webContents.send("auth-callback", {
        stackRefresh,
        stackAccess
      });
    }
  }
}
