import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, shell, protocol } from "electron";
import { join } from "node:path";

let mainWindow: BrowserWindow | null = null;

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

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("cmux", process.execPath, [process.argv[1]]);
  }
} else {
  app.setAsDefaultProtocolClient("cmux");
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine, _workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      
      const url = commandLine.find((arg) => arg.startsWith("cmux://"));
      if (url) {
        handleProtocolUrl(url);
      }
    }
  });

  app.on("open-url", (_event, url) => {
    handleProtocolUrl(url);
  });

  app.whenReady().then(() => {
    createWindow();

    app.on("activate", function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function handleProtocolUrl(url: string): void {
  if (!mainWindow) return;
  
  const urlObj = new URL(url);
  
  if (urlObj.hostname === "auth-callback") {
    const refreshToken = urlObj.searchParams.get("refresh_token");
    
    if (refreshToken) {
      mainWindow.webContents.send("auth-callback", { refreshToken });
    }
  }
}
