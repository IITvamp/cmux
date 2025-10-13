import { log } from "./logger";
import type { DetectedPort, DevServerHeuristics } from "./portMonitor";

interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

interface CDPVersionInfo {
  Browser: string;
  "Protocol-Version": string;
  "User-Agent": string;
  "V8-Version": string;
  "WebKit-Version": string;
  webSocketDebuggerUrl: string;
}

/**
 * Chrome DevTools Protocol client for opening previews
 */
export class ChromePreviewClient {
  private cdpBaseUrl: string;
  private openedPorts = new Set<number>();

  constructor(
    private readonly options: {
      cdpHost?: string;
      cdpPort?: number;
      // Container-internal port where services are accessible
      // (e.g., if a dev server runs on 5173 inside container, it's at localhost:5173)
      localHost?: string;
    } = {}
  ) {
    const host = options.cdpHost ?? "127.0.0.1";
    const port = options.cdpPort ?? 39381;
    this.cdpBaseUrl = `http://${host}:${port}`;
  }

  /**
   * Check if Chrome CDP is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.cdpBaseUrl}/json/version`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return false;
      }

      const version = (await response.json()) as CDPVersionInfo;
      log("INFO", "Chrome CDP is available", {
        browser: version.Browser,
        wsUrl: version.webSocketDebuggerUrl,
      });

      return true;
    } catch (error) {
      log("DEBUG", "Chrome CDP not available", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get list of open tabs/targets
   */
  async listTargets(): Promise<CDPTarget[]> {
    try {
      const response = await fetch(`${this.cdpBaseUrl}/json/list`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Failed to list targets: ${response.statusText}`);
      }

      return (await response.json()) as CDPTarget[];
    } catch (error) {
      log("ERROR", "Failed to list Chrome targets", error);
      return [];
    }
  }

  /**
   * Create a new tab/target
   */
  async createTab(url: string): Promise<CDPTarget | null> {
    try {
      const response = await fetch(
        `${this.cdpBaseUrl}/json/new?${encodeURIComponent(url)}`,
        {
          method: "PUT",
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create tab: ${response.statusText}`);
      }

      return (await response.json()) as CDPTarget;
    } catch (error) {
      log("ERROR", `Failed to create Chrome tab for ${url}`, error);
      return null;
    }
  }

  /**
   * Close a tab/target
   */
  async closeTab(targetId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.cdpBaseUrl}/json/close/${targetId}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch (error) {
      log("ERROR", `Failed to close Chrome tab ${targetId}`, error);
      return false;
    }
  }

  /**
   * Activate a tab/target (bring to front)
   */
  async activateTab(targetId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.cdpBaseUrl}/json/activate/${targetId}`, {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch (error) {
      log("ERROR", `Failed to activate Chrome tab ${targetId}`, error);
      return false;
    }
  }

  /**
   * Open a preview of a detected dev server
   */
  async openPreview(
    detectedPort: DetectedPort,
    heuristics: DevServerHeuristics
  ): Promise<void> {
    // Check if we've already opened this port
    if (this.openedPorts.has(detectedPort.port)) {
      log("DEBUG", `Already opened preview for port ${detectedPort.port}`);
      return;
    }

    const localHost = this.options.localHost ?? "localhost";
    const url = `http://${localHost}:${detectedPort.port}`;

    log("INFO", `Opening Chrome preview for dev server`, {
      port: detectedPort.port,
      url,
      framework: heuristics.framework,
      processName: detectedPort.processName,
    });

    try {
      // Check if Chrome is available
      const available = await this.isAvailable();
      if (!available) {
        log("WARN", "Chrome CDP is not available, cannot open preview");
        return;
      }

      // Check if a tab with this URL already exists
      const existingTargets = await this.listTargets();
      const existingTab = existingTargets.find((target) =>
        target.url.startsWith(url)
      );

      if (existingTab) {
        log("INFO", `Tab for ${url} already exists, activating it`, {
          targetId: existingTab.id,
        });

        await this.activateTab(existingTab.id);
        this.openedPorts.add(detectedPort.port);
        return;
      }

      // Create new tab
      const newTab = await this.createTab(url);

      if (newTab) {
        log("INFO", `Successfully opened Chrome preview for port ${detectedPort.port}`, {
          targetId: newTab.id,
          url: newTab.url,
        });

        this.openedPorts.add(detectedPort.port);

        // Activate the new tab
        await this.activateTab(newTab.id);
      } else {
        log("ERROR", `Failed to create Chrome tab for ${url}`);
      }
    } catch (error) {
      log("ERROR", `Error opening Chrome preview for port ${detectedPort.port}`, error);
    }
  }

  /**
   * Get the set of ports that have been opened
   */
  getOpenedPorts(): Set<number> {
    return new Set(this.openedPorts);
  }

  /**
   * Reset the opened ports tracking (useful for testing or re-enabling previews)
   */
  resetOpenedPorts(): void {
    this.openedPorts.clear();
    log("INFO", "Reset opened ports tracking");
  }
}

/**
 * Auto-preview manager that combines port monitoring with Chrome preview opening
 */
export class AutoPreviewManager {
  private chromeClient: ChromePreviewClient;
  private enabled = false;

  constructor(
    private readonly options: {
      cdpHost?: string;
      cdpPort?: number;
      localHost?: string;
      // Only auto-open for ports matching these heuristics
      requireLikelyDevServer?: boolean;
      requireProcessNameMatch?: boolean;
    } = {}
  ) {
    this.chromeClient = new ChromePreviewClient({
      cdpHost: options.cdpHost,
      cdpPort: options.cdpPort,
      localHost: options.localHost,
    });
  }

  /**
   * Enable auto-preview
   */
  async enable(): Promise<boolean> {
    if (this.enabled) {
      log("DEBUG", "Auto-preview already enabled");
      return true;
    }

    // Check if Chrome is available
    const available = await this.chromeClient.isAvailable();
    if (!available) {
      log("WARN", "Cannot enable auto-preview: Chrome CDP is not available");
      return false;
    }

    this.enabled = true;
    log("INFO", "Auto-preview enabled", {
      requireLikelyDevServer: this.options.requireLikelyDevServer ?? true,
      requireProcessNameMatch: this.options.requireProcessNameMatch ?? false,
    });

    return true;
  }

  /**
   * Disable auto-preview
   */
  disable(): void {
    this.enabled = false;
    log("INFO", "Auto-preview disabled");
  }

  /**
   * Check if auto-preview is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Handle a newly detected port
   */
  async handleNewPort(
    port: DetectedPort,
    heuristics: DevServerHeuristics
  ): Promise<void> {
    if (!this.enabled) {
      log("DEBUG", `Auto-preview disabled, ignoring port ${port.port}`);
      return;
    }

    // Apply additional filters based on options
    if (this.options.requireLikelyDevServer && !heuristics.likelyDevServer) {
      log("DEBUG", `Port ${port.port} doesn't match likely dev server criteria`);
      return;
    }

    if (this.options.requireProcessNameMatch && !heuristics.processNameMatch) {
      log("DEBUG", `Port ${port.port} doesn't match process name criteria`);
      return;
    }

    // Open the preview
    await this.chromeClient.openPreview(port, heuristics);
  }

  /**
   * Get the Chrome client for manual operations
   */
  getChromeClient(): ChromePreviewClient {
    return this.chromeClient;
  }
}
