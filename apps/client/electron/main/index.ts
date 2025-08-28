import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, shell, dialog, ipcMain } from "electron";
import { join } from "node:path";
import { autoUpdater } from "electron-updater";

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

  return mainWindow;
}

// Auto-updater configuration
if (!is.dev) {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("update-available", () => {
    // Send notification to renderer process
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send("update-available");
    });
  });

  autoUpdater.on("update-downloaded", () => {
    // Send notification to renderer process
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send("update-downloaded");
    });
  });

  autoUpdater.on("error", (error) => {
    console.error("Auto-updater error:", error);
    // Send error notification to renderer process
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send("update-error", error.message);
    });
  });
}
      });
  });

  autoUpdater.on("error", (error) => {
    console.error("Auto-updater error:", error);
  });
}

// IPC handlers for update functionality
ipcMain.handle("restart-app", () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle("check-for-updates", async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return result;
  } catch (error) {
    console.error("Manual update check failed:", error);
    throw error;
  }
});

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  mainWindow = createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
