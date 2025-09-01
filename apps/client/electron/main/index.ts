import { is } from "@electron-toolkit/utils";
import {
  app,
  BrowserWindow,
  dialog,
  net,
  session,
  shell,
  autoUpdater,
} from "electron";
import path, { join } from "node:path";
import { pathToFileURL } from "node:url";
import { autoUpdater as linuxAutoUpdater } from "electron-updater";

// Use a cookieable HTTPS origin intercepted locally instead of a custom scheme.
const PARTITION = "persist:cmux";
const APP_HOST = "cmux.local";

let rendererLoaded = false;
let pendingProtocolUrl: string | null = null;
let mainWindow: BrowserWindow | null = null;

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
      partition: PARTITION,
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

function handleProtocolUrl(url: string): void {
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

      mainWindow.webContents.session.cookies.set({
        url: currentUrl,
        name: `stack-refresh-8a877114-b905-47c5-8b64-3a2d90679577`,
        value: stackRefresh,
      });

      mainWindow.webContents.session.cookies.set({
        url: currentUrl,
        name: "stack-access",
        value: stackAccess,
      });
    }
  }
}

async function setupAutoUpdates() {
  // Only run updates in production; Linux has no built-in support.
  if (!app.isPackaged) return;

  // Recommended on Windows for proper taskbar pinning.
  try {
    app.setAppUserModelId("com.cmux.app");
  } catch {
    // ignore
  }

  // Static storage base URL, e.g. https://my-bucket.s3.amazonaws.com/my-app-updates
  const baseRoot = process.env.CMUX_UPDATES_BASE_URL;
  if (!baseRoot) return;
  const root = baseRoot.replace(/\/$/, "");

  if (process.platform === "linux") {
    // Use electron-updater (generic provider) on Linux
    try {
      linuxAutoUpdater.autoDownload = true;
      linuxAutoUpdater.setFeedURL({
        provider: "generic",
        url: `${root}/linux/${process.arch}`,
      });

      linuxAutoUpdater.on("error", (err) => {
        if (err) {
          console.error("Linux AutoUpdater error:", (err as Error).message);
        }
      });
      linuxAutoUpdater.on("update-downloaded", () => {
        const dialogOpts = {
          type: "info" as const,
          buttons: ["Restart", "Later"],
          title: "Application Update",
          message: "Update ready to install",
          detail:
            "A new version has been downloaded. Restart to apply the update.",
        };
        dialog.showMessageBox(dialogOpts).then((ret) => {
          if (ret.response === 0) linuxAutoUpdater.quitAndInstall();
        });
      });

      try {
        await linuxAutoUpdater.checkForUpdates();
      } catch {
        // ignore
      }
      const tenMinutes = 10 * 60 * 1000;
      setInterval(() => {
        try {
          linuxAutoUpdater.checkForUpdates();
        } catch {
          // ignore
        }
      }, tenMinutes);
    } catch (e) {
      console.error("Failed to initialize linux auto-updater", e);
    }
    return;
  }

  // macOS/Windows via built-in Squirrel autoUpdater
  const firstRun =
    process.platform === "win32" &&
    process.argv.includes("--squirrel-firstrun");
  const platformPath = `${process.platform}/${process.arch}`;
  const isMac = process.platform === "darwin";
  // For macOS, use a simple JSON endpoint (latest.json) per Electron docs
  const feedUrl = isMac
    ? `${root}/${platformPath}/latest.json`
    : `${root}/${platformPath}`;

  try {
    if (isMac) {
      autoUpdater.setFeedURL({ url: feedUrl, serverType: "json" });
    } else {
      autoUpdater.setFeedURL({ url: feedUrl });
    }
  } catch (e) {
    console.error("Failed to set feed URL", e);
    return;
  }

  autoUpdater.on("error", (err: Error) => {
    console.error("AutoUpdater error:", err.message);
  });
  autoUpdater.on(
    "update-downloaded",
    (_event, releaseNotes: string, releaseName: string) => {
      const message = process.platform === "win32" ? releaseNotes : releaseName;
      const dialogOpts = {
        type: "info" as const,
        buttons: ["Restart", "Later"],
        title: "Application Update",
        message,
        detail:
          "A new version has been downloaded. Restart to apply the update.",
      };
      dialog.showMessageBox(dialogOpts).then((ret) => {
        if (ret.response === 0) autoUpdater.quitAndInstall();
      });
    }
  );

  const initialDelayMs = firstRun ? 10000 : 0;
  setTimeout(() => {
    try {
      autoUpdater.checkForUpdates();
    } catch {
      // ignore
    }
  }, initialDelayMs);
}
