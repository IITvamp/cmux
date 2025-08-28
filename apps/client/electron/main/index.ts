import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, shell, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import { join } from "node:path";

function createWindow(): void {
  const mainWindow = new BrowserWindow({
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
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // Initialize auto-updates after the window is ready.
  initAutoUpdates(mainWindow);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function initAutoUpdates(win: BrowserWindow): void {
  // Only check for updates in packaged production builds.
  if (!app.isPackaged) {
    return;
  }

  // Allow prerelease updates on non-stable channels if version includes "-".
  autoUpdater.allowPrerelease = app.getVersion().includes("-");
  autoUpdater.autoDownload = true;

  // Log update events to help debugging in all platforms.
  autoUpdater.on("checking-for-update", () => {
    console.log("autoUpdater: checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("autoUpdater: update available", info.version);
  });

  autoUpdater.on("update-not-available", () => {
    console.log("autoUpdater: no update available");
  });

  autoUpdater.on("error", (err) => {
    console.error("autoUpdater error:", err);
  });

  autoUpdater.on("download-progress", (progress) => {
    const pct = Math.round(progress.percent);
    win.setProgressBar(progress.percent / 100);
    console.log(`autoUpdater: download progress ${pct}%`);
    if (pct >= 100) {
      // Clear progress bar when done.
      win.setProgressBar(-1);
    }
  });

  autoUpdater.on("update-downloaded", async (info) => {
    console.log("autoUpdater: update downloaded", info.version);
    const result = await dialog.showMessageBox(win, {
      type: "info",
      buttons: ["Restart", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Update available",
      message: "A new version has been downloaded.",
      detail: "Restart the app to apply the update.",
    });
    if (result.response === 0) {
      // On macOS, this must be called after all windows are closed.
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });

  // Initial check and notify.
  void autoUpdater.checkForUpdatesAndNotify();

  // Periodic re-check (every 12 hours).
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  setInterval(() => {
    void autoUpdater.checkForUpdatesAndNotify();
  }, twelveHoursMs);
}
