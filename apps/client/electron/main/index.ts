import { is } from "@electron-toolkit/utils";
import {
  app,
  BrowserWindow,
  dialog,
  nativeImage,
  net,
  session,
  shell,
  type BrowserWindowConstructorOptions,
} from "electron";
import path, { join } from "node:path";
import { pathToFileURL } from "node:url";
import { autoUpdater as updater } from "electron-updater";
import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTPayload,
} from "jose";

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

async function handleOrQueueProtocolUrl(url: string) {
  if (mainWindow && rendererLoaded) {
    await handleProtocolUrl(url);
  } else {
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
    mainWindow?.show();
  });

  // Once the renderer is loaded, process any queued deep-link
  mainWindow.webContents.on("did-finish-load", () => {
    rendererLoaded = true;
    if (pendingProtocolUrl) {
      void handleProtocolUrl(pendingProtocolUrl);
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
    // In production, serve the renderer over HTTPS on a private host which we
    // intercept and back with local files (supports cookies).
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

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Configure auto updates when packaged.
  setupAutoUpdates();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Simple in-memory cache of RemoteJWKSet by issuer
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksForIssuer(issuer: string) {
  const base = issuer.endsWith("/") ? issuer : issuer + "/";
  // Stack Auth exposes JWKS at <issuer>/.well-known/jwks.json
  const url = new URL(".well-known/jwks.json", base);
  let jwks = jwksCache.get(url.toString());
  if (!jwks) {
    jwks = createRemoteJWKSet(url);
    jwksCache.set(url.toString(), jwks);
  }
  return jwks;
}

async function verifyJwtAndGetPayload(
  token: string
): Promise<JWTPayload | null> {
  try {
    const decoded = decodeJwt(token);
    const iss = decoded.iss;
    if (!iss) return null;
    const JWKS = jwksForIssuer(iss);
    const { payload } = await jwtVerify(token, JWKS, { issuer: iss });
    return payload;
  } catch {
    return null;
  }
}

async function handleProtocolUrl(url: string): Promise<void> {
  if (!mainWindow) {
    // Should not happen due to queuing, but guard anyway
    pendingProtocolUrl = url;
    return;
  }

  const urlObj = new URL(url);

  if (urlObj.hostname === "auth-callback") {
    // Check for the full URL parameter
    const stackRefresh = urlObj.searchParams.get(`stack_refresh`);
    const stackAccess = urlObj.searchParams.get("stack_access");

    if (stackRefresh && stackAccess) {
      // Determine a cookieable URL. Prefer our custom cmux:// origin when not
      // running against an http(s) dev server.
      const currentUrl = mainWindow.webContents.getURL();

      const [refreshPayload, accessPayload] = await Promise.all([
        verifyJwtAndGetPayload(stackRefresh),
        verifyJwtAndGetPayload(stackAccess),
      ]);

      if (refreshPayload && accessPayload) {
        const refreshExp =
          typeof refreshPayload.exp === "number" &&
          Number.isFinite(refreshPayload.exp)
            ? refreshPayload.exp
            : undefined;
        const accessExp =
          typeof accessPayload.exp === "number" &&
          Number.isFinite(accessPayload.exp)
            ? accessPayload.exp
            : undefined;

        mainWindow.webContents.session.cookies.set({
          url: currentUrl,
          name: `stack-refresh-8a877114-b905-47c5-8b64-3a2d90679577`,
          value: stackRefresh,
          expirationDate: refreshExp,
        });

        mainWindow.webContents.session.cookies.set({
          url: currentUrl,
          name: "stack-access",
          value: stackAccess,
          expirationDate: accessExp,
        });
      }
    }
  }
}

function setupAutoUpdates(): void {
  if (!app.isPackaged) return;

  try {
    app.setAppUserModelId("com.cmux.app");
  } catch {
    // ignore
  }

  // Unified updater for macOS, Windows, and Linux using GitHub provider via app-update.yml
  try {
    updater.autoDownload = true;
    updater.on("error", (err) => {
      if (err) console.error("AutoUpdater error:", (err as Error).message);
    });
    updater.on("update-downloaded", () => {
      const dialogOpts = {
        type: "info" as const,
        buttons: ["Restart", "Later"],
        title: "Application Update",
        message: "Update ready to install",
        detail:
          "A new version has been downloaded. Restart to apply the update.",
      };
      dialog.showMessageBox(dialogOpts).then((ret) => {
        if (ret.response === 0) updater.quitAndInstall();
      });
    });
    void updater.checkForUpdates();
    const tenMinutes = 10 * 60 * 1000;
    setInterval(() => void updater.checkForUpdates(), tenMinutes);
  } catch (e) {
    console.error("Failed to initialize auto-updater", e);
  }
}
