import { PortMonitor, type DevServerDetection } from "./port-monitor";
import { ChromeCDPClient, type NavigationResult } from "./chrome-cdp-client";
import { EventEmitter } from "node:events";

export interface PreviewConfig {
  cdpPort?: number;
  cdpHost?: string;
  enabled?: boolean;
  minConfidence?: number;
  autoNavigate?: boolean;
  excludedPorts?: number[];
}

export function getDefaultPreviewConfig(): Required<PreviewConfig> {
  return {
    cdpPort: parseInt(process.env.CMUX_CDP_PORT || '39382'),
    cdpHost: process.env.CMUX_CDP_HOST || '127.0.0.1',
    enabled: process.env.CMUX_DEV_SERVER_PREVIEW_ENABLED !== 'false', // Default true
    minConfidence: parseFloat(process.env.CMUX_DEV_SERVER_PREVIEW_MIN_CONFIDENCE || '0.6'),
    autoNavigate: process.env.CMUX_DEV_SERVER_PREVIEW_AUTO_NAVIGATE !== 'false', // Default true
    excludedPorts: (process.env.CMUX_DEV_SERVER_PREVIEW_EXCLUDED_PORTS || '')
      .split(',')
      .map(p => parseInt(p.trim()))
      .filter(p => !isNaN(p))
  };
}

export class DevServerPreview extends EventEmitter {
  private portMonitor: PortMonitor;
  private chromeClient: ChromeCDPClient;
  private config: Required<PreviewConfig>;
  private connected = false;

  constructor(config: PreviewConfig = {}) {
    super();

    const defaults = getDefaultPreviewConfig();
    this.config = {
      cdpPort: config.cdpPort ?? defaults.cdpPort,
      cdpHost: config.cdpHost ?? defaults.cdpHost,
      enabled: config.enabled ?? defaults.enabled,
      minConfidence: config.minConfidence ?? defaults.minConfidence,
      autoNavigate: config.autoNavigate ?? defaults.autoNavigate,
      excludedPorts: config.excludedPorts ?? defaults.excludedPorts
    };

    this.portMonitor = new PortMonitor();
    this.chromeClient = new ChromeCDPClient(this.config.cdpPort, this.config.cdpHost);

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.portMonitor.on('dev-server-detected', (detection: DevServerDetection) => {
      this.handleDevServerDetected(detection);
    });

    this.portMonitor.on('error', (error) => {
      this.emit('error', error);
    });

    this.chromeClient.on('connected', () => {
      this.connected = true;
      this.emit('chrome-connected');
    });

    this.chromeClient.on('disconnected', () => {
      this.connected = false;
      this.emit('chrome-disconnected');
    });

    this.chromeClient.on('error', (error) => {
      this.emit('error', error);
    });
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Connect to Chrome CDP
      await this.chromeClient.connect();

      // Start monitoring ports
      this.portMonitor.start();

      this.emit('started');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  stop() {
    this.portMonitor.stop();
    this.chromeClient.disconnect();
    this.emit('stopped');
  }

  private async handleDevServerDetected(detection: DevServerDetection) {
    // Check if port is excluded
    if (this.config.excludedPorts.includes(detection.port)) {
      return;
    }

    // Check confidence threshold
    if (detection.confidence < this.config.minConfidence) {
      return;
    }

    this.emit('dev-server-detected', detection);

    if (this.config.autoNavigate && this.connected) {
      try {
        const result = await this.chromeClient.navigate(detection.url);
        this.emit('navigation-attempted', result);
      } catch (error) {
        this.emit('navigation-error', { detection, error });
      }
    }
  }

  async navigateToUrl(url: string): Promise<NavigationResult> {
    if (!this.connected) {
      throw new Error('Chrome CDP not connected');
    }

    return await this.chromeClient.navigate(url);
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      chromeConnected: this.connected,
      monitoring: this.portMonitor['monitoring'],
      config: this.config
    };
  }
}