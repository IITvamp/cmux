import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, shell } from "electron";
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

// Handle OAuth callback from web app
function handleOAuthCallback(url: string): void {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === "cmux:" && urlObj.pathname === "/auth/callback") {
      const refreshToken = urlObj.searchParams.get("refreshToken");
      const state = urlObj.searchParams.get("state");

      if (refreshToken && mainWindow) {
        // Send the refresh token to the renderer process
        mainWindow.webContents.send("oauth-callback", {
          refreshToken,
          state,
        });

        // Focus the main window
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
    }
  } catch (error) {
    console.error("Failed to handle OAuth callback:", error);
  }
}

app.whenReady().then(() => {
  // Register the cmux protocol
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient("cmux", process.execPath, [
        join(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient("cmux");
  }

  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Handle OAuth callback URLs
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleOAuthCallback(url);
});

// Handle second instance (when app is already running)
app.on("second-instance", (event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }

  // Check if there's an OAuth callback URL in the arguments
  const url = argv.find((arg) => arg.startsWith("cmux://"));
  if (url) {
    handleOAuthCallback(url);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
