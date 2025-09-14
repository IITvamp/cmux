import path, { join } from "node:path";
import { pathToFileURL } from "node:url";

import { is } from "@electron-toolkit/utils";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  net,
  session,
  shell,
  webContents,
  webFrameMain,
  type BrowserWindowConstructorOptions,
  type MenuItemConstructorOptions,
} from "electron";
import { startEmbeddedServer } from "./embedded-server";
// Auto-updater
import electronUpdater from "electron-updater";
import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTPayload,
} from "jose";
import {
  createWriteStream,
  existsSync,
  promises as fs,
  mkdirSync,
  type WriteStream,
} from "node:fs";
const { autoUpdater } = electronUpdater;

import util from "node:util";
import { env } from "./electron-main-env";

// Use a cookieable HTTPS origin intercepted locally instead of a custom scheme.
const PARTITION = "persist:cmux";
const APP_HOST = "cmux.local";

let rendererLoaded = false;
let pendingProtocolUrl: string | null = null;
let mainWindow: BrowserWindow | null = null;
// Track whether the Command Palette (Cmd+K) is currently open in the renderer.
let cmdkOpen = false;
// Track the last captured focus location per BrowserWindow (by renderer webContents id)
const lastFocusByWindow = new Map<
  number,
  { contentsId: number; frameRoutingId: number; frameProcessId: number }
>();

// Persistent log files
let logsDir: string | null = null;
let mainLogStream: WriteStream | null = null;
let rendererLogStream: WriteStream | null = null;
let keyDebugStream: WriteStream | null = null;

function getTimestamp(): string {
  return new Date().toISOString();
}

function ensureLogStreams(): void {
  if (logsDir) return; // already initialized
  const base = app.getPath("userData");
  const dir = path.join(base, "logs");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  logsDir = dir;
  mainLogStream = createWriteStream(path.join(dir, "main.log"), {
    flags: "a",
    encoding: "utf8",
  });
  rendererLogStream = createWriteStream(path.join(dir, "renderer.log"), {
    flags: "a",
    encoding: "utf8",
  });
}

function writeMainLogLine(level: "LOG" | "WARN" | "ERROR", line: string): void {
  if (!mainLogStream) return;
  mainLogStream.write(`[${getTimestamp()}] [MAIN] [${level}] ${line}\n`);
}

function writeRendererLogLine(
  level: "info" | "warning" | "error" | "debug",
  line: string
): void {
  if (!rendererLogStream) return;
  rendererLogStream.write(
    `[${getTimestamp()}] [RENDERER] [${level.toUpperCase()}] ${line}\n`
  );
}

function setupConsoleFileMirrors(): void {
  const orig = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  } as const;

  console.log = (...args: unknown[]) => {
    try {
      orig.log(...args);
    } finally {
      try {
        writeMainLogLine("LOG", formatArgs(args));
      } catch {
        // ignore
      }
    }
  };
  console.warn = (...args: unknown[]) => {
    try {
      orig.warn(...args);
    } finally {
      try {
        writeMainLogLine("WARN", formatArgs(args));
      } catch {
        // ignore
      }
    }
  };
  console.error = (...args: unknown[]) => {
    try {
      orig.error(...args);
    } finally {
      try {
        writeMainLogLine("ERROR", formatArgs(args));
      } catch {
        // ignore
      }
    }
  };
}

function ensureKeyDebugFile(): void {
  try {
    if (keyDebugStream) return;
    // Try to place a debug file in the repository logs/ folder during dev
    // else fall back to userData/logs.
    const appPath = app.getAppPath();
    let repoLogs: string | null = null;
    try {
      // Heuristic: appPath ends in apps/client in dev. Go up two levels.
      const maybeRoot = path.resolve(appPath, "../..");
      const candidate = path.join(maybeRoot, "logs");
      if (!existsSync(candidate)) mkdirSync(candidate, { recursive: true });
      repoLogs = candidate;
    } catch {
      repoLogs = null;
    }
    const outDir = repoLogs || logsDir || app.getPath("userData");
    const filePath = path.join(outDir, "cmdk-debug.log");
    keyDebugStream = createWriteStream(filePath, {
      flags: "a",
      encoding: "utf8",
    });
    mainLog("CmdK debug log path:", filePath);
  } catch (e) {
    // If anything fails, ignore; we'll just rely on main.log
    mainWarn("Failed to initialize CmdK debug log file", e);
  }
}

function keyDebug(event: string, data?: unknown): void {
  try {
    ensureKeyDebugFile();
    const line = JSON.stringify({
      ts: getTimestamp(),
      event,
      data,
    });
    keyDebugStream?.write(line + "\n");
  } catch {
    // ignore
  }
}

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

  console.log("[MAIN]", line);
  emitToRenderer("log", `[MAIN] ${line}`);
}

export function mainWarn(...args: unknown[]) {
  const line = formatArgs(args);

  console.warn("[MAIN]", line);
  emitToRenderer("warn", `[MAIN] ${line}`);
}

export function mainError(...args: unknown[]) {
  const line = formatArgs(args);

  console.error("[MAIN]", line);
  emitToRenderer("error", `[MAIN] ${line}`);
}

// Write critical errors to a file to aid debugging packaged crashes
async function writeFatalLog(...args: unknown[]) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const base = app.getPath("userData");
    const file = path.join(base, `fatal-${ts}.log`);
    const msg = formatArgs(args);
    await fs.writeFile(file, msg + "\n", { encoding: "utf8" });
  } catch {
    // ignore
  }
}

process.on("uncaughtException", (err) => {
  try {
    console.error("[MAIN] uncaughtException", err);
  } catch {
    // ignore
  }
  void writeFatalLog("uncaughtException", err);
});
process.on("unhandledRejection", (reason) => {
  try {
    console.error("[MAIN] unhandledRejection", reason);
  } catch {
    // ignore
  }
  void writeFatalLog("unhandledRejection", reason);
});

function setupAutoUpdates(): void {
  if (!app.isPackaged) {
    mainLog("Skipping auto-updates in development");
    return;
  }

  try {
    // Wire logs to our logger
    (autoUpdater as unknown as { logger: unknown }).logger = {
      info: (...args: unknown[]) => mainLog("[updater]", ...args),
      warn: (...args: unknown[]) => mainWarn("[updater]", ...args),
      error: (...args: unknown[]) => mainError("[updater]", ...args),
    } as unknown as typeof autoUpdater.logger;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
  } catch (e) {
    mainWarn("Failed to initialize autoUpdater", e);
    return;
  }

  autoUpdater.on("checking-for-update", () => mainLog("Checking for update…"));
  autoUpdater.on("update-available", (info) =>
    mainLog("Update available", info?.version)
  );
  autoUpdater.on("update-not-available", () => mainLog("No updates available"));
  autoUpdater.on("error", (err) => mainWarn("Updater error", err));
  autoUpdater.on("download-progress", (p) =>
    mainLog(
      "Update download progress",
      `${p.percent?.toFixed?.(1) ?? 0}% (${p.transferred}/${p.total})`
    )
  );
  autoUpdater.on("update-downloaded", async () => {
    if (!mainWindow) {
      mainLog("No main window; skipping update prompt");
      return;
    }

    try {
      const res = await dialog.showMessageBox(mainWindow, {
        type: "info",
        buttons: ["Restart Now", "Later"],
        defaultId: 0,
        cancelId: 1,
        message: "An update is ready to install.",
        detail: "Restart Cmux to apply the latest version.",
      });
      if (res.response === 0) {
        mainLog("User accepted update; quitting and installing");
        autoUpdater.quitAndInstall();
      } else {
        mainLog("User deferred update installation");
      }
    } catch (e) {
      mainWarn("Failed to prompt for installing update", e);
      autoUpdater.quitAndInstall();
    }
  });

  // Initial check and periodic re-checks
  autoUpdater
    .checkForUpdatesAndNotify()
    .catch((e) => mainWarn("checkForUpdatesAndNotify failed", e));
  setInterval(
    () => {
      autoUpdater
        .checkForUpdates()
        .catch((e) => mainWarn("Periodic checkForUpdates failed", e));
    },
    30 * 60 * 1000
  ); // 30 minutes
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
      preload: join(app.getAppPath(), "out/preload/index.cjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
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

  // Capture renderer console output into renderer.log
  mainWindow.webContents.on(
    "console-message",
    ({ level, lineNumber, message, sourceId }) => {
      const src = sourceId
        ? `${sourceId}${lineNumber ? `:${lineNumber}` : ""}`
        : "";
      const msg = src ? `${message} (${src})` : message;
      writeRendererLogLine(level, msg);
    }
  );

  mainWindow.on("ready-to-show", () => {
    mainLog("Window ready-to-show");
    mainWindow?.show();
  });

  // Socket bridge not required; renderer connects directly

  // Initialize auto-updates
  setupAutoUpdates();

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

app.whenReady().then(async () => {
  ensureLogStreams();
  setupConsoleFileMirrors();
  ensureKeyDebugFile();

  // Ensure macOS menu and About panel use "cmux" instead of package.json name
  if (process.platform === "darwin") {
    try {
      app.setName("cmux");
      app.setAboutPanelOptions({ applicationName: "cmux" });
    } catch {
      // ignore if not supported
    }
  }

  // Capture Cmd+K within the app only (works across iframes/webviews)
  try {
    // Attach to all webContents including webviews and subframes
    app.on("web-contents-created", (_event, contents) => {
      try {
        keyDebug("web-contents-created", {
          id: contents.id,
          type: contents.getType?.(),
          url: contents.getURL?.(),
        });
      } catch {
        // ignore debug log failures
      }
      try {
        contents.on("before-input-event", (e, input) => {
          keyDebug("before-input-event", {
            id: contents.id,
            type: contents.getType?.(),
            key: input.key,
            code: input.code,
            meta: input.meta,
            ctrl: input.control,
            alt: input.alt,
            shift: input.shift,
            typeInput: input.type,
          });
          if (input.type !== "keyDown") return;
          const isMac = process.platform === "darwin";
          const isCmdK =
            (isMac ? input.meta : input.control) &&
            !input.alt &&
            input.key.toLowerCase() === "k";
          if (!isCmdK) return;
          // Prevent default to avoid in-app conflicts (e.g., terminal clear)
          // and ensure a single toggle per key press.
          e.preventDefault();
          keyDebug("cmdk-detected", {
            sourceId: contents.id,
            type: contents.getType?.(),
          });
          // If the Command Palette is already open, do NOT overwrite the
          // previously captured focus target. Simply emit the toggle event.
          if (cmdkOpen) {
            keyDebug("skip-capture-already-open", { id: contents.id });
            const targetWin =
              BrowserWindow.getFocusedWindow() ??
              mainWindow ??
              BrowserWindow.getAllWindows()[0] ??
              null;
            if (targetWin && !targetWin.isDestroyed()) {
              try {
                targetWin.webContents.send("cmux:event:shortcut:cmd-k");
                keyDebug("emit-cmdk", {
                  to: targetWin.webContents.id,
                  from: contents.id,
                });
              } catch (err) {
                mainWarn("Failed to emit Cmd+K (already open)", err);
                keyDebug("emit-cmdk-error", { err: String(err) });
              }
            }
            return;
          }

          // Otherwise, capture the currently focused element inside this
          // WebContents BEFORE we emit to the renderer (which might change focus).
          try {
            const frame = contents.focusedFrame ?? contents.mainFrame;
            frame
              .executeJavaScript(
                `(() => { try {
                  const el = document.activeElement;
                  // Store element and tag for better restore + debugging
                  window.__cmuxLastFocused = el;
                  // @ts-ignore - attach for debug
                  window.__cmuxLastFocusedTag = el?.tagName ?? null;
                  return window.__cmuxLastFocusedTag || true;
                } catch { return false } })()`,
                true
              )
              .then((res) => {
                keyDebug("capture-last-focused", {
                  id: contents.id,
                  res,
                  frameRoutingId: frame.routingId,
                  frameProcessId: frame.processId,
                  frameUrl: frame.url,
                  frameOrigin: frame.origin,
                });
                const targetWin =
                  BrowserWindow.getFocusedWindow() ??
                  mainWindow ??
                  BrowserWindow.getAllWindows()[0] ??
                  null;
                if (targetWin && !targetWin.isDestroyed()) {
                  try {
                    // Remember where focus came from for this window so we can
                    // restore it later without renderer passing ids back.
                    lastFocusByWindow.set(targetWin.webContents.id, {
                      contentsId: contents.id,
                      frameRoutingId: frame.routingId,
                      frameProcessId: frame.processId,
                    });
                    keyDebug("remember-last-focus", {
                      windowId: targetWin.webContents.id,
                      contentsId: contents.id,
                      frameRoutingId: frame.routingId,
                      frameProcessId: frame.processId,
                    });
                  } catch {
                    // ignore
                  }
                  try {
                    targetWin.webContents.send("cmux:event:shortcut:cmd-k", {
                      sourceContentsId: contents.id,
                      sourceFrameRoutingId: frame.routingId,
                      sourceFrameProcessId: frame.processId,
                    });
                    keyDebug("emit-cmdk", {
                      to: targetWin.webContents.id,
                      from: contents.id,
                      frameRoutingId: frame.routingId,
                      frameProcessId: frame.processId,
                    });
                  } catch (err) {
                    mainWarn(
                      "Failed to emit Cmd+K from before-input-event",
                      err
                    );
                    keyDebug("emit-cmdk-error", { err: String(err) });
                  }
                }
              })
              .catch((err) =>
                keyDebug("capture-last-focused-error", {
                  id: contents.id,
                  err: String(err),
                })
              );
          } catch {
            // ignore capture failures
          }
        });
      } catch {
        // ignore
      }
    });

    // Allow renderer to explicitly focus a specific WebContents id
    ipcMain.handle("cmux:ui:focus-webcontents", (_evt, id: number) => {
      try {
        const wc = webContents.fromId(id);
        if (!wc || wc.isDestroyed()) return { ok: false };
        wc.focus();
        keyDebug("focus-webcontents", { id });
        return { ok: true };
      } catch (err) {
        mainWarn("Failed to focus webContents", { id, err });
        keyDebug("focus-webcontents-error", { id, err: String(err) });
        return { ok: false };
      }
    });

    ipcMain.handle(
      "cmux:ui:webcontents-restore-last-focus",
      async (_evt, id: number) => {
        try {
          const wc = webContents.fromId(id);
          if (!wc || wc.isDestroyed()) return { ok: false };
          await wc.focus();
          keyDebug("restore-last-focus.begin", { id });
          const ok = await wc.executeJavaScript(
            `(() => {
              try {
                const el = window.__cmuxLastFocused;
                if (el && typeof el.focus === 'function') {
                  el.focus();
                  if (el.tagName === 'IFRAME') {
                    try { el.contentWindow && el.contentWindow.focus && el.contentWindow.focus(); } catch {}
                  }
                  return true;
                }
                const a = document.activeElement;
                if (a && typeof a.focus === 'function') { a.focus(); return true; }
                if (document.body && typeof document.body.focus === 'function') { document.body.focus(); return true; }
                return false;
              } catch { return false; }
            })()`,
            true
          );
          keyDebug("restore-last-focus.result", { id, ok });
          return { ok: Boolean(ok) };
        } catch (err) {
          mainWarn("Failed to restore focus in webContents", { id, err });
          keyDebug("restore-last-focus.error", { id, err: String(err) });
          return { ok: false };
        }
      }
    );

    ipcMain.handle(
      "cmux:ui:frame-restore-last-focus",
      async (
        _evt,
        info: {
          contentsId: number;
          frameRoutingId: number;
          frameProcessId: number;
        }
      ) => {
        try {
          const wc = webContents.fromId(info.contentsId);
          if (!wc || wc.isDestroyed()) return { ok: false };
          const frame = webFrameMain.fromId(
            info.frameProcessId,
            info.frameRoutingId
          );
          if (!frame) {
            keyDebug("frame-restore-last-focus.no-frame", info);
            return { ok: false };
          }
          await wc.focus();
          keyDebug("frame-restore-last-focus.begin", info);
          const ok = await frame.executeJavaScript(
            `(() => {
              try {
                const el = window.__cmuxLastFocused;
                if (el && typeof el.focus === 'function') { el.focus(); return true; }
                const a = document.activeElement;
                if (a && typeof a.focus === 'function') { a.focus(); return true; }
                if (document.body && typeof document.body.focus === 'function') { document.body.focus(); return true; }
                return false;
              } catch { return false; }
            })()`,
            true
          );
          keyDebug("frame-restore-last-focus.result", { ...info, ok });
          return { ok: Boolean(ok) };
        } catch (err) {
          keyDebug("frame-restore-last-focus.error", {
            ...info,
            err: String(err),
          });
          return { ok: false };
        }
      }
    );

    // Renderer reports when Command Palette opens/closes so we don't
    // overwrite previously captured focus while it's open.
    ipcMain.handle(
      "cmux:ui:set-command-palette-open",
      (_evt, isOpen: boolean) => {
        try {
          cmdkOpen = Boolean(isOpen);
          keyDebug("cmdk-open-state", { open: cmdkOpen });
          return { ok: true };
        } catch (err) {
          keyDebug("cmdk-open-state-error", { err: String(err) });
          return { ok: false };
        }
      }
    );

    // Simple restore using stored last focus info for this window
    ipcMain.handle("cmux:ui:restore-last-focus", async (evt) => {
      try {
        const windowWcId = evt.sender.id;
        const info = lastFocusByWindow.get(windowWcId);
        keyDebug("window-restore-last-focus.begin", { windowWcId, info });
        if (!info) return { ok: false };
        const wc = webContents.fromId(info.contentsId);
        if (!wc || wc.isDestroyed()) return { ok: false };
        const frame = webFrameMain.fromId(
          info.frameProcessId,
          info.frameRoutingId
        );
        if (!frame) return { ok: false };
        await wc.focus();
        const ok = await frame.executeJavaScript(
          `(() => {
            try {
              const el = window.__cmuxLastFocused;
              if (el && typeof el.focus === 'function') { el.focus(); return true; }
              const a = document.activeElement;
              if (a && typeof a.focus === 'function') { a.focus(); return true; }
              if (document.body && typeof document.body.focus === 'function') { document.body.focus(); return true; }
              return false;
            } catch { return false; }
          })()`,
          true
        );
        keyDebug("window-restore-last-focus.result", { windowWcId, ok });
        return { ok: Boolean(ok) };
      } catch (err) {
        keyDebug("window-restore-last-focus.error", { err: String(err) });
        return { ok: false };
      }
    });
  } catch (e) {
    mainWarn("Error setting up before-input-event handler for Cmd+K", e);
  }

  // Start the embedded IPC server (registers cmux:register and cmux:rpc)
  try {
    mainLog("Starting embedded IPC server...");
    await startEmbeddedServer();
    mainLog("Embedded IPC server started successfully");
  } catch (error) {
    mainError("Failed to start embedded IPC server:", error);
    process.exit(1);
  }

  // Try to register the custom protocol handler with the OS. electron-builder
  // will add CFBundleURLTypes on macOS, but calling this is harmless and also
  // helps on Windows/Linux when packaged.
  try {
    const ok = app.setAsDefaultProtocolClient("cmux");
    mainLog("setAsDefaultProtocolClient(cmux)", {
      ok,
      packaged: app.isPackaged,
    });
  } catch (e) {
    mainWarn("setAsDefaultProtocolClient failed", e);
  }

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
      mainWarn("Blocked path outside baseDir", { fsPath, baseDir });
      return new Response("Not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(fsPath).toString());
  });

  // Create the initial window.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();

  // Application menu with Command Palette accelerator; keep Help items.
  try {
    const template: MenuItemConstructorOptions[] = [];
    if (process.platform === "darwin") {
      template.push({ role: "appMenu" });
    } else {
      template.push({ label: "File", submenu: [{ role: "quit" }] });
    }
    template.push(
      { role: "editMenu" },
      {
        label: "Commands",
        submenu: [
          {
            label: "Command Palette…",
            accelerator: "CommandOrControl+K",
            click: () => {
              try {
                const target =
                  BrowserWindow.getFocusedWindow() ??
                  mainWindow ??
                  BrowserWindow.getAllWindows()[0] ??
                  null;
                keyDebug("menu-accelerator-cmdk", {
                  to: target?.webContents.id,
                });
                if (target && !target.isDestroyed()) {
                  target.webContents.send("cmux:event:shortcut:cmd-k");
                }
              } catch (err) {
                mainWarn("Failed to emit Cmd+K from menu accelerator", err);
                keyDebug("menu-accelerator-cmdk-error", { err: String(err) });
              }
            },
          },
        ],
      },
      { role: "viewMenu" },
      { role: "windowMenu" }
    );
    template.push({
      role: "help",
      submenu: [
        {
          label: "Check for Updates…",
          click: async () => {
            if (!app.isPackaged) {
              await dialog.showMessageBox({
                type: "info",
                message: "Updates are only available in packaged builds.",
              });
              return;
            }
            try {
              mainLog("Manual update check initiated");
              const result = await autoUpdater.checkForUpdates();
              if (!result?.updateInfo) {
                await dialog.showMessageBox({
                  type: "info",
                  message: "You’re up to date.",
                });
              }
            } catch (e) {
              mainWarn("Manual checkForUpdates failed", e);
              await dialog.showMessageBox({
                type: "error",
                message: "Failed to check for updates.",
              });
            }
          },
        },
        {
          label: "Open Logs Folder",
          click: async () => {
            if (!logsDir) ensureLogStreams();
            if (logsDir) await shell.openPath(logsDir);
          },
        },
      ],
    });
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } catch (e) {
    mainWarn("Failed to set application menu", e);
  }

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  try {
    mainLogStream?.end();
    rendererLogStream?.end();
  } catch {
    // ignore
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
    mainWarn("handleProtocolUrl called with no window; queueing", { url });
    pendingProtocolUrl = url;
    return;
  }

  const urlObj = new URL(url);

  if (urlObj.hostname === "auth-callback") {
    const rawStackRefresh = urlObj.searchParams.get("stack_refresh");
    const rawStackAccess = urlObj.searchParams.get("stack_access");

    if (!rawStackRefresh || !rawStackAccess) {
      mainWarn("Aborting cookie set due to missing tokens");
      return;
    }

    // Check for the full URL parameter
    const stackRefresh = encodeURIComponent(rawStackRefresh);
    const stackAccess = encodeURIComponent(rawStackAccess);

    // Verify tokens with Stack JWKS and extract exp for cookie expiry.
    const [refreshPayload, accessPayload] = await Promise.all([
      verifyJwtAndGetPayload(stackRefresh),
      verifyJwtAndGetPayload(stackAccess),
    ]);

    if (refreshPayload?.exp === null || accessPayload?.exp === null) {
      mainWarn("Aborting cookie set due to invalid tokens");
      return;
    }

    // Determine a cookieable URL. Prefer our custom cmux:// origin when not
    // running against an http(s) dev server.
    const currentUrl = new URL(mainWindow.webContents.getURL());
    currentUrl.hash = "";
    const realUrl = currentUrl.toString() + "/";

    await Promise.all([
      mainWindow.webContents.session.cookies.remove(
        realUrl,
        `stack-refresh-${env.NEXT_PUBLIC_STACK_PROJECT_ID}`
      ),
      mainWindow.webContents.session.cookies.remove(realUrl, `stack-access`),
    ]);

    await Promise.all([
      mainWindow.webContents.session.cookies.set({
        url: realUrl,
        name: `stack-refresh-${env.NEXT_PUBLIC_STACK_PROJECT_ID}`,
        value: stackRefresh,
        expirationDate: refreshPayload?.exp,
        sameSite: "no_restriction",
        secure: true,
      }),
      mainWindow.webContents.session.cookies.set({
        url: realUrl,
        name: "stack-access",
        value: stackAccess,
        expirationDate: accessPayload?.exp,
        sameSite: "no_restriction",
        secure: true,
      }),
    ]);

    mainWindow.webContents.reload();
    return;
  }

  if (urlObj.hostname === "github-connect-complete") {
    try {
      mainLog("Deep link: github-connect-complete", {
        team: urlObj.searchParams.get("team"),
      });
      // Bring app to front and refresh to pick up new connections
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      const team = urlObj.searchParams.get("team");
      try {
        mainWindow.webContents.send("cmux:event:github-connect-complete", {
          team,
        });
      } catch (emitErr) {
        mainWarn("Failed to emit github-connect-complete", emitErr);
      }
    } catch (e) {
      mainWarn("Failed to handle github-connect-complete", e);
    }
    return;
  }
}
