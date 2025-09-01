import { app, session, net, BrowserWindow, shell } from "electron";
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
const PARTITION = "persist:cmux";
const APP_HOST = "cmux.local";
let rendererLoaded = false;
let pendingProtocolUrl = null;
let mainWindow = null;
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
      nodeIntegration: false,
      partition: PARTITION
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
    mainWindow.loadURL(`https://${APP_HOST}/index.html`);
  }
}
app.on("open-url", (_event, url) => {
  handleOrQueueProtocolUrl(url);
});
app.whenReady().then(() => {
  const baseDir = path.join(app.getAppPath(), "out", "renderer");
  const ses = session.fromPartition(PARTITION);
  ses.protocol.handle("https", async (req) => {
    const u = new URL(req.url);
    if (u.hostname !== APP_HOST) return net.fetch(req);
    const pathname = u.pathname === "/" ? "/index.html" : u.pathname;
    const fsPath = path.normalize(
      path.join(baseDir, decodeURIComponent(pathname))
    );
    const rel = path.relative(baseDir, fsPath);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
      return new Response("Not found", { status: 404 });
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
function decodeJwtExp(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = base64urlDecode(parts[1]);
    const payload = JSON.parse(json);
    if (payload && typeof payload === "object") {
      const exp = payload["exp"];
      if (typeof exp === "number" && Number.isFinite(exp)) return exp;
      if (typeof exp === "string" && exp.trim() !== "") {
        const n = Number(exp);
        return Number.isFinite(n) ? n : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}
function base64urlDecode(input) {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(s, "base64").toString("utf8");
  }
  const binary = atob(s);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function handleProtocolUrl(url) {
  if (!mainWindow) {
    pendingProtocolUrl = url;
    return;
  }
  const urlObj = new URL(url);
  if (urlObj.hostname === "auth-callback") {
    const stackRefresh = urlObj.searchParams.get(`stack_refresh`);
    const stackAccess = urlObj.searchParams.get("stack_access");
    if (stackRefresh && stackAccess) {
      const currentUrl = mainWindow.webContents.getURL();
      const refreshExp = decodeJwtExp(stackRefresh);
      const accessExp = decodeJwtExp(stackAccess);
      mainWindow.webContents.session.cookies.set({
        url: currentUrl,
        name: `stack-refresh-8a877114-b905-47c5-8b64-3a2d90679577`,
        value: stackRefresh,
        expirationDate: refreshExp ?? void 0
      });
      mainWindow.webContents.session.cookies.set({
        url: currentUrl,
        name: "stack-access",
        value: stackAccess,
        expirationDate: accessExp ?? void 0
      });
    }
  }
}
export {
  decodeJwtExp
};
