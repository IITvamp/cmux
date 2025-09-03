import { is } from "@electron-toolkit/utils";
import {
  app,
  BrowserWindow,
  nativeImage,
  net,
  session,
  shell,
  type BrowserWindowConstructorOptions,
} from "electron";
import path, { join } from "node:path";
import { pathToFileURL } from "node:url";
import util from "node:util";

// Use a cookieable HTTPS origin intercepted locally instead of a custom scheme.
const PARTITION = "persist:cmux";
const APP_HOST = "cmux.local";

let rendererLoaded = false;
let pendingProtocolUrl: string | null = null;
let mainWindow: BrowserWindow | null = null;

function resolveResourcePath(rel: string) {
  // Prod: packaged resources directory; Dev: look under client/assets
  if (app.isPackaged) return path.join(process.resourcesPath, rel);
  return path.join(app.getAppPath(), "assets", rel);
}

// Lightweight logger that prints to the main process stdout and mirrors
// into the renderer console (via preload listener) when available.
type LogLevel = "log" | "warn" | "error";
function emitToRenderer(level: LogLevel, message: string) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("main-log", { level, message });
    }
  } catch {
    // ignore mirror failures
  }
}

function formatArgs(args: unknown[]): string {
  const ts = new Date().toISOString();
  const body = args
    .map((a) =>
      typeof a === "string" ? a : util.inspect(a, { depth: 3, colors: false })
    )
    .join(" ");
  return `[${ts}] ${body}`;
}

export function mainLog(...args: unknown[]) {
  const line = formatArgs(args);
  // eslint-disable-next-line no-console
  console.log("[MAIN]", line);
  emitToRenderer("log", `[MAIN] ${line}`);
}

export function mainWarn(...args: unknown[]) {
  const line = formatArgs(args);
  // eslint-disable-next-line no-console
  console.warn("[MAIN]", line);
  emitToRenderer("warn", `[MAIN] ${line}`);
}

export function mainError(...args: unknown[]) {
  const line = formatArgs(args);
  // eslint-disable-next-line no-console
  console.error("[MAIN]", line);
  emitToRenderer("error", `[MAIN] ${line}`);
}

async function handleOrQueueProtocolUrl(url: string) {
  if (mainWindow && rendererLoaded) {
    mainLog("Handling protocol URL immediately", { url });
    await handleProtocolUrl(url);
  } else {
    mainLog("Queueing protocol URL until renderer ready", { url });
    pendingProtocolUrl = url;
  }
}

function createWindow(): void {
  const windowOptions: BrowserWindowConstructorOptions = {
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
      partition: PARTITION,
    },
  };

  // Use only the icon from cmux-logos iconset.
  const iconPng = resolveResourcePath(
    "cmux-logos/cmux.iconset/icon_512x512.png"
  );
  if (process.platform !== "darwin") {
    windowOptions.icon = iconPng;
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.on("ready-to-show", () => {
    mainLog("Window ready-to-show");
    mainWindow?.show();
  });

  // Once the renderer is loaded, process any queued deep-link
  mainWindow.webContents.on("did-finish-load", () => {
    mainLog("Renderer finished load");
    rendererLoaded = true;
    if (pendingProtocolUrl) {
      mainLog("Processing queued protocol URL", { url: pendingProtocolUrl });
      void handleProtocolUrl(pendingProtocolUrl);
      pendingProtocolUrl = null;
    }
  });

  mainWindow.webContents.on("did-navigate", (_e, url) => {
    mainLog("did-navigate", { url });
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    const url = process.env["ELECTRON_RENDERER_URL"]!;
    mainLog("Loading renderer (dev)", { url });
    mainWindow.loadURL(url);
  } else {
    // In production, serve the renderer over HTTPS on a private host which we
    // intercept and back with local files (supports cookies).
    mainLog("Loading renderer (prod)", { host: APP_HOST });
    mainWindow.loadURL(`https://${APP_HOST}/index.html`);
  }
}

app.on("open-url", (_event, url) => {
  handleOrQueueProtocolUrl(url);
});

app.whenReady().then(() => {
  // When packaged, electron-vite outputs the renderer to out/renderer
  // which is bundled inside app.asar (referenced by app.getAppPath()).
  const baseDir = path.join(app.getAppPath(), "out", "renderer");

  // Set Dock icon from iconset on macOS.
  if (process.platform === "darwin") {
    const iconPng = resolveResourcePath(
      "cmux-logos/cmux.iconset/icon_512x512.png"
    );
    const img = nativeImage.createFromPath(iconPng);
    if (!img.isEmpty()) app.dock?.setIcon(img);
  }

  const ses = session.fromPartition(PARTITION);
  // Intercept HTTPS for our private host and serve local files; pass-through others.
  ses.protocol.handle("https", async (req) => {
    mainLog("Protocol handler invoked", { url: req.url });
    const u = new URL(req.url);
    if (u.hostname !== APP_HOST) return net.fetch(req);
    const pathname = u.pathname === "/" ? "/index.html" : u.pathname;
    const fsPath = path.normalize(
      path.join(baseDir, decodeURIComponent(pathname))
    );
    const rel = path.relative(baseDir, fsPath);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
      mainWarn("Blocked path outside baseDir", { fsPath, baseDir });
      return new Response("Not found", { status: 404 });
    }
    mainLog("Serving local file", { fsPath });
    return net.fetch(pathToFileURL(fsPath).toString());
  });

  // // Register deep-link protocol (packaged and, best-effort, dev).
  // registerDeepLinkProtocol();

  // Create the initial window.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();

  // // Handle a deep link if the app was launched via protocol while closed
  // // (Windows/Linux: initial argv; macOS uses open-url).
  // const initialLink = extractDeepLinkFromArgv(process.argv);
  // if (initialLink) handleOrQueueProtocolUrl(initialLink);

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

async function handleProtocolUrl(url: string): Promise<void> {
  if (!mainWindow) {
    // Should not happen due to queuing, but guard anyway
    mainWarn("handleProtocolUrl called with no window; queueing", { url });
    pendingProtocolUrl = url;
    return;
  }

  const urlObj = new URL(url);

  if (urlObj.hostname === "auth-callback") {
    // Check for the full URL parameter
    const stackRefresh = encodeURIComponent(
      urlObj.searchParams.get("stack_refresh") ?? ""
    );
    const stackAccess = encodeURIComponent(
      urlObj.searchParams.get("stack_access") ?? ""
    );

    if (stackRefresh && stackAccess) {
      // Determine a cookieable URL. Prefer our custom cmux:// origin when not
      // running against an http(s) dev server.
      const currentUrl = new URL(mainWindow.webContents.getURL());
      currentUrl.hash = "";
      const realUrl = currentUrl.toString() + "/";

      await Promise.all([
        mainWindow.webContents.session.cookies.remove(
          realUrl,
          `stack-refresh-1467bed0-8522-45ee-a8d8-055de324118c`
        ),
        mainWindow.webContents.session.cookies.remove(realUrl, `stack-access`),
      ]);

      await Promise.all([
        mainWindow.webContents.session.cookies.set({
          url: realUrl,
          name: `stack-refresh-1467bed0-8522-45ee-a8d8-055de324118c`,
          value: stackRefresh,
          expirationDate: 2000000000,
          sameSite: "no_restriction",
          secure: true,
        }),
        mainWindow.webContents.session.cookies.set({
          url: realUrl,
          name: "stack-access",
          value: stackAccess,
          expirationDate: 2000000000,
          sameSite: "no_restriction",
          secure: true,
        }),
      ]);

      mainLog("set stackRefresh: ", stackRefresh);
      mainLog("set stackAccess: ", stackAccess);
    }
  }
}
