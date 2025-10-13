import { WebSocket } from "undici";
import { log } from "./logger";
import type { DevServerProcessInfo } from "./devServerDetector";

const DEFAULT_CDP_HOST = process.env.CDP_TARGET_HOST || "127.0.0.1";
const DEFAULT_CDP_PORT = Number.parseInt(
  process.env.CDP_TARGET_PORT || "39382",
  10,
);
const HTTP_CHECK_TIMEOUT_MS = 2_000;
const REOPEN_INTERVAL_MS = 60_000;

interface ChromePreviewOptions {
  host?: string;
  port?: number;
  workerId?: string;
  logger?: typeof log;
  fetchImpl?: typeof fetch;
}

export class ChromePreviewController {
  private readonly host: string;
  private readonly port: number;
  private readonly workerId?: string;
  private readonly logger: typeof log;
  private readonly fetchImpl: typeof fetch;
  private readonly openedPorts = new Map<number, number>();

  constructor(options: ChromePreviewOptions = {}) {
    this.host = options.host || DEFAULT_CDP_HOST;
    this.port = Number.isFinite(options.port)
      ? (options.port as number)
      : DEFAULT_CDP_PORT;
    this.workerId = options.workerId;
    this.logger = options.logger ?? log;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async openDevServer(info: DevServerProcessInfo): Promise<boolean> {
    const { port, cmdline, processName, pid } = info;
    const lastOpened = this.openedPorts.get(port);
    const now = Date.now();
    if (lastOpened && now - lastOpened < REOPEN_INTERVAL_MS) {
      return false;
    }

    const schemes = inferPreferredSchemes(cmdline);
    for (const scheme of schemes) {
      const targetUrl = `${scheme}://localhost:${port}/`;
      const reachable = await this.verifyService(targetUrl);
      if (!reachable) {
        continue;
      }

      const opened = await this.openInChrome(targetUrl);
      if (opened) {
        this.openedPorts.set(port, now);
        this.logger(
          "INFO",
          "[ChromePreview] Opened dev server in Chrome",
          {
            port,
            targetUrl,
            pid,
            processName,
            cmdline,
          },
          this.workerId,
        );
        return true;
      }
    }

    this.logger(
      "WARN",
      "[ChromePreview] Failed to verify dev server before opening",
      { port, pid, processName, cmdline },
      this.workerId,
    );
    return false;
  }

  private async verifyService(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HTTP_CHECK_TIMEOUT_MS);
      timeout.unref?.();
      const response = await this.fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response.ok || (response.status >= 200 && response.status < 500);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "unknown");
      this.logger(
        "DEBUG",
        "[ChromePreview] Service check failed",
        { url, error: message },
        this.workerId,
      );
      return false;
    }
  }

  private async openInChrome(targetUrl: string): Promise<boolean> {
    const base = `http://${this.host}:${this.port}`;
    const encoded = encodeURIComponent(targetUrl);
    const httpEndpoint = `${base}/json/new?${encoded}`;

    try {
      const response = await this.fetchImpl(httpEndpoint, { method: "GET" });
      if (response.ok) {
        return true;
      }
      this.logger(
        "WARN",
        "[ChromePreview] CDP new tab endpoint returned non-OK",
        { status: response.status, statusText: response.statusText },
        this.workerId,
      );
      return this.openViaWebSocket(targetUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "unknown");
      this.logger(
        "WARN",
        "[ChromePreview] Failed to open preview via HTTP endpoint, falling back",
        { error: message, targetUrl },
        this.workerId,
      );
      return this.openViaWebSocket(targetUrl);
    }

    return false;
  }

  private async openViaWebSocket(targetUrl: string): Promise<boolean> {
    try {
      const versionEndpoint = `http://${this.host}:${this.port}/json/version`;
      const response = await this.fetchImpl(versionEndpoint, { method: "GET" });
      if (!response.ok) {
        return false;
      }
      const data = (await response.json()) as {
        webSocketDebuggerUrl?: string;
      };
      if (!data.webSocketDebuggerUrl) {
        return false;
      }

      const ws = new WebSocket(data.webSocketDebuggerUrl);

      const result = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 2_000);
        timer.unref?.();

        ws.addEventListener("open", () => {
          ws.send(
            JSON.stringify({
              id: 1,
              method: "Target.createTarget",
              params: { url: targetUrl },
            }),
          );
        });

        ws.addEventListener("message", (event) => {
          try {
            const payload = JSON.parse(event.data as string) as { id?: number };
            if (payload.id === 1) {
              clearTimeout(timer);
              ws.close();
              resolve(true);
            }
          } catch {
            // Ignore parse errors
          }
        });

        ws.addEventListener("error", () => {
          clearTimeout(timer);
          ws.close();
          resolve(false);
        });
      });

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "unknown");
      this.logger(
        "ERROR",
        "[ChromePreview] WebSocket fallback failed",
        { error: message, targetUrl },
        this.workerId,
      );
      return false;
    }
  }
}

export function inferPreferredSchemes(cmdline: string | null): [string, string] {
  const normalized = cmdline?.toLowerCase() ?? "";
  if (
    normalized.includes("https") ||
    normalized.includes("--https") ||
    normalized.includes("--ssl") ||
    normalized.includes("tls")
  ) {
    return ["https", "http"];
  }
  return ["http", "https"];
}
