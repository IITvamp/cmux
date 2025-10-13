import { EventEmitter } from "node:events";

export interface ChromeTab {
  id: string;
  title: string;
  url: string;
  type: string;
}

export interface NavigationResult {
  url: string;
  success: boolean;
  error?: string;
  tabId?: string;
}

export class ChromeCDPClient extends EventEmitter {
  private wsConnection?: WebSocket;
  private nextId = 1;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private tabs: ChromeTab[] = [];
  private targetId?: string;

  constructor(
    private cdpPort = 39382,
    private host = '127.0.0.1'
  ) {
    super();
  }

  async connect(): Promise<void> {
    const wsUrl = `ws://${this.host}:${this.cdpPort}/devtools/browser`;

    return new Promise((resolve, reject) => {
      try {
        this.wsConnection = new WebSocket(wsUrl);

        this.wsConnection.onopen = () => {
          this.emit('connected');
          resolve();
        };

        this.wsConnection.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.wsConnection.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };

        this.wsConnection.onclose = () => {
          this.emit('disconnected');
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = undefined;
    }
  }

  private async sendCommand(method: string, params: any = {}): Promise<any> {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      throw new Error('Chrome CDP connection not established');
    }

    const id = this.nextId++;
    const message = JSON.stringify({
      id,
      method,
      params
    });

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`CDP command ${method} timed out`));
      }, 10000);

      const originalResolve = resolve;
      const originalReject = reject;

      this.pendingRequests.set(id, {
        resolve: (result: any) => {
          clearTimeout(timeout);
          originalResolve(result);
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          originalReject(error);
        }
      });

      this.wsConnection!.send(message);
    });
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);

      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id)!;
        this.pendingRequests.delete(message.id);

        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result);
        }
      } else if (message.method) {
        // Handle events
        this.handleEvent(message.method, message.params);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  private handleEvent(method: string, params: any) {
    this.emit('event', method, params);

    // Handle specific events
    if (method === 'Target.targetCreated') {
      this.emit('target-created', params.targetInfo);
    } else if (method === 'Target.targetDestroyed') {
      this.emit('target-destroyed', params.targetId);
    }
  }

  async getTabs(): Promise<ChromeTab[]> {
    const result = await this.sendCommand('Target.getTargets');
    this.tabs = result.targetInfos.filter((target: any) => target.type === 'page');
    return this.tabs;
  }

  async createTab(url?: string): Promise<string> {
    const result = await this.sendCommand('Target.createTarget', {
      url: url || 'about:blank'
    });
    return result.targetId;
  }

  async navigateTab(tabId: string, url: string): Promise<NavigationResult> {
    try {
      // Attach to the target
      await this.sendCommand('Target.attachToTarget', {
        targetId: tabId,
        flatten: true
      });

      // Enable Page domain
      await this.sendCommand('Page.enable');

      // Navigate to URL
      const result = await this.sendCommand('Page.navigate', { url });

      // Wait a bit for navigation to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        url,
        success: true,
        tabId
      };
    } catch (error) {
      return {
        url,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tabId
      };
    }
  }

  async navigate(url: string): Promise<NavigationResult> {
    try {
      // Get existing tabs
      const tabs = await this.getTabs();

      // Try to find an existing tab we can reuse (prefer about:blank or chrome://newtab)
      let targetTab = tabs.find(tab =>
        tab.url === 'about:blank' ||
        tab.url === 'chrome://newtab/' ||
        tab.url.startsWith('chrome://')
      );

      if (!targetTab) {
        // Create a new tab if no suitable existing tab found
        const tabId = await this.createTab();
        targetTab = { id: tabId, title: '', url: 'about:blank', type: 'page' };
      }

      return await this.navigateTab(targetTab.id, url);
    } catch (error) {
      return {
        url,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to navigate'
      };
    }
  }

  async closeTab(tabId: string): Promise<void> {
    await this.sendCommand('Target.closeTarget', { targetId: tabId });
  }
}