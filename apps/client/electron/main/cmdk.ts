import path from "node:path";
import { createWriteStream, existsSync, mkdirSync, type WriteStream } from "node:fs";
import {
  app,
  BrowserWindow,
  ipcMain,
  webContents,
  webFrameMain,
} from "electron";

type Logger = {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

let keyDebugStream: WriteStream | null = null;

function getTimestamp(): string {
  return new Date().toISOString();
}

function ensureKeyDebugFile(logger: Logger): void {
  try {
    if (keyDebugStream) return;
    // Prefer repo logs/ during dev; fallback to userData/logs
    const appPath = app.getAppPath();
    let outDir: string;
    try {
      const maybeRoot = path.resolve(appPath, "../..");
      const repoLogs = path.join(maybeRoot, "logs");
      if (!existsSync(repoLogs)) mkdirSync(repoLogs, { recursive: true });
      outDir = repoLogs;
    } catch {
      const ud = path.join(app.getPath("userData"), "logs");
      if (!existsSync(ud)) mkdirSync(ud, { recursive: true });
      outDir = ud;
    }
    const filePath = path.join(outDir, "cmdk-debug.log");
    keyDebugStream = createWriteStream(filePath, { flags: "a", encoding: "utf8" });
    logger.log("CmdK debug log path:", filePath);
  } catch (e) {
    logger.warn("Failed to initialize CmdK debug log file", e);
  }
}

export function keyDebug(event: string, data?: unknown): void {
  try {
    const line = JSON.stringify({ ts: getTimestamp(), event, data });
    keyDebugStream?.write(line + "\n");
  } catch {
    // ignore
  }
}

// Track whether the Command Palette (Cmd+K) is currently open in any renderer
let cmdkOpen = false;

// Track the last captured focus location per BrowserWindow (by renderer webContents id)
const lastFocusByWindow = new Map<
  number,
  { contentsId: number; frameRoutingId: number; frameProcessId: number }
>();

export function initCmdK(opts: {
  getMainWindow: () => BrowserWindow | null;
  logger: Logger;
}): void {
  ensureKeyDebugFile(opts.logger);

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
        // Only trigger on EXACT Cmd+K (mac) or Ctrl+K (others)
        const isCmdK = (() => {
          if (input.key.toLowerCase() !== "k") return false;
          if (input.alt || input.shift) return false;
          if (isMac) {
            // Require meta only; disallow ctrl on mac
            return Boolean(input.meta) && !input.control;
          }
          // Non-mac: require ctrl only; disallow meta
          return Boolean(input.control) && !input.meta;
        })();
        if (!isCmdK) return;
        // Prevent default to avoid in-app conflicts and ensure single toggle
        e.preventDefault();
        keyDebug("cmdk-detected", {
          sourceId: contents.id,
          type: contents.getType?.(),
        });

        const getTargetWindow = (): BrowserWindow | null => {
          return (
            BrowserWindow.getFocusedWindow() ??
            opts.getMainWindow() ??
            BrowserWindow.getAllWindows()[0] ??
            null
          );
        };

        // If already open, just toggle; do not overwrite previous capture
        if (cmdkOpen) {
          keyDebug("skip-capture-already-open", { id: contents.id });
          const targetWin = getTargetWindow();
          if (targetWin && !targetWin.isDestroyed()) {
            try {
              targetWin.webContents.send("cmux:event:shortcut:cmd-k");
              keyDebug("emit-cmdk", {
                to: targetWin.webContents.id,
                from: contents.id,
              });
            } catch (err) {
              opts.logger.warn("Failed to emit Cmd+K (already open)", err);
              keyDebug("emit-cmdk-error", { err: String(err) });
            }
          }
          return;
        }

        // Capture the currently focused element BEFORE emitting toggle
        try {
          const frame = contents.focusedFrame ?? contents.mainFrame;
          frame
            .executeJavaScript(
              `(() => { try {
                const el = document.activeElement;
                // Store for restore + debugging
                window.__cmuxLastFocused = el;
                // @ts-ignore
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
              const targetWin = getTargetWindow();
              if (targetWin && !targetWin.isDestroyed()) {
                try {
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
                  opts.logger.warn(
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

  // IPC helpers
  ipcMain.handle("cmux:ui:focus-webcontents", (_evt, id: number) => {
    try {
      const wc = webContents.fromId(id);
      if (!wc || wc.isDestroyed()) return { ok: false };
      wc.focus();
      keyDebug("focus-webcontents", { id });
      return { ok: true };
    } catch (err) {
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
        keyDebug("restore-last-focus.error", { id, err: String(err) });
        return { ok: false };
      }
    }
  );

  ipcMain.handle(
    "cmux:ui:frame-restore-last-focus",
    async (
      _evt,
      info: { contentsId: number; frameRoutingId: number; frameProcessId: number }
    ) => {
      try {
        const wc = webContents.fromId(info.contentsId);
        if (!wc || wc.isDestroyed()) return { ok: false };
        const frame = webFrameMain.fromId(info.frameProcessId, info.frameRoutingId);
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
        keyDebug("frame-restore-last-focus.error", { ...info, err: String(err) });
        return { ok: false };
      }
    }
  );

  // Renderer reports when Command Palette opens/closes so we don't
  // overwrite previously captured focus while it's open.
  ipcMain.handle("cmux:ui:set-command-palette-open", (_evt, isOpen: boolean) => {
    try {
      cmdkOpen = Boolean(isOpen);
      keyDebug("cmdk-open-state", { open: cmdkOpen });
      return { ok: true };
    } catch (err) {
      keyDebug("cmdk-open-state-error", { err: String(err) });
      return { ok: false };
    }
  });

  // Simple restore using stored last focus info for this window
  ipcMain.handle("cmux:ui:restore-last-focus", async (evt) => {
    try {
      const windowWcId = evt.sender.id;
      const info = lastFocusByWindow.get(windowWcId);
      keyDebug("window-restore-last-focus.begin", { windowWcId, info });
      if (!info) return { ok: false };
      const wc = webContents.fromId(info.contentsId);
      if (!wc || wc.isDestroyed()) return { ok: false };
      const frame = webFrameMain.fromId(info.frameProcessId, info.frameRoutingId);
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
}
