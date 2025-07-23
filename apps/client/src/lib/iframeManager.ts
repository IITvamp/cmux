// Extend the Element interface to include moveBefore
declare global {
  interface Element {
    moveBefore?(node: Node, child: Node | null): void;
  }
}

type IframeEntry = {
  iframe: HTMLIFrameElement;
  url: string;
  lastUsed: number;
  currentContainer: HTMLElement | null;
};

class IframeManager {
  private iframes = new Map<string, IframeEntry>();
  private maxIframes = 10; // Configurable limit to prevent memory issues
  private hiddenContainer: HTMLElement | null = null;

  /**
   * Get or create an iframe for the given key and URL
   */
  getOrCreateIframe(key: string, url: string): HTMLIFrameElement {
    const existing = this.iframes.get(key);

    if (existing) {
      existing.lastUsed = Date.now();
      // Update URL if it changed
      if (existing.url !== url) {
        existing.iframe.src = url;
        existing.url = url;
      }
      return existing.iframe;
    }

    // Create new iframe
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.setAttribute("data-iframe-key", key); // Add identifier for debugging

    const entry: IframeEntry = {
      iframe,
      url,
      lastUsed: Date.now(),
      currentContainer: null,
    };

    this.iframes.set(key, entry);

    // Clean up old iframes if we exceed the limit
    this.cleanupOldIframes();

    return iframe;
  }

  /**
   * Check if moveBefore is supported
   */
  private isMoveBeforeSupported(): boolean {
    return (
      "moveBefore" in Element.prototype &&
      typeof Element.prototype.moveBefore === "function"
    );
  }

  /**
   * Preload an iframe for future use
   */
  preloadIframe(key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const iframe = this.getOrCreateIframe(key, url);

      const handleLoad = () => {
        iframe.removeEventListener("load", handleLoad);
        iframe.removeEventListener("error", handleError);
        resolve();
      };

      const handleError = () => {
        iframe.removeEventListener("load", handleLoad);
        iframe.removeEventListener("error", handleError);
        reject(new Error(`Failed to load iframe: ${url}`));
      };

      // If iframe is already loaded, resolve immediately
      if (iframe.contentWindow && iframe.src === url) {
        resolve();
        return;
      }

      iframe.addEventListener("load", handleLoad);
      iframe.addEventListener("error", handleError);

      // If not attached to DOM yet, attach to a hidden container to start loading
      if (!iframe.parentElement) {
        const hiddenContainer = this.getHiddenContainer();
        hiddenContainer.appendChild(iframe);
      }
    });
  }

  /**
   * Get or create a hidden container for preloading iframes
   */
  private getHiddenContainer(): HTMLElement {
    if (this.hiddenContainer && document.body.contains(this.hiddenContainer)) {
      return this.hiddenContainer;
    }

    this.hiddenContainer = document.createElement("div");
    this.hiddenContainer.id = "iframe-manager-hidden-container";
    this.hiddenContainer.style.cssText = `
      position: absolute;
      left: -9999px;
      top: -9999px;
      visibility: hidden;
    `;

    // Ensure it's attached to body
    if (document.body) {
      document.body.appendChild(this.hiddenContainer);
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        if (this.hiddenContainer && !this.hiddenContainer.parentElement) {
          document.body.appendChild(this.hiddenContainer);
        }
      });
    }

    return this.hiddenContainer;
  }

  /**
   * Mount an iframe to a container element using moveBefore for state preservation
   */
  mountIframe(key: string, containerElement: HTMLElement): void {
    const entry = this.iframes.get(key);
    if (!entry) {
      throw new Error(
        `Iframe with key "${key}" not found. Call getOrCreateIframe first.`
      );
    }

    const { iframe } = entry;

    // If iframe is already in the target container, nothing to do
    if (iframe.parentElement === containerElement) {
      return;
    }

    try {
      // Ensure the iframe is in the DOM before attempting to move it
      if (!iframe.parentElement) {
        // If not in DOM, just append normally
        containerElement.appendChild(iframe);
      } else if (this.isMoveBeforeSupported() && containerElement.moveBefore) {
        // Use moveBefore for state-preserving move
        // First, ensure we're not trying to move within the same parent in an invalid way
        if (iframe.parentElement === containerElement) {
          return;
        }

        // Perform the move
        containerElement.moveBefore(iframe, null); // null means append at the end
      } else {
        // Fallback for browsers that don't support moveBefore
        console.warn("moveBefore not supported, iframe will reload");

        // Remove from current parent and append to new container
        if (iframe.parentElement) {
          iframe.parentElement.removeChild(iframe);
        }
        containerElement.appendChild(iframe);
      }
    } catch (error) {
      console.error("Error mounting iframe:", error);

      // Fallback to regular appendChild if moveBefore fails
      if (iframe.parentElement && iframe.parentElement !== containerElement) {
        iframe.parentElement.removeChild(iframe);
      }
      containerElement.appendChild(iframe);
    }

    entry.currentContainer = containerElement;
    entry.lastUsed = Date.now();
  }

  /**
   * Unmount an iframe and move it to the hidden container
   */
  unmountIframe(key: string): void {
    const entry = this.iframes.get(key);
    if (!entry || !entry.iframe.parentElement) return;

    const hiddenContainer = this.getHiddenContainer();

    // Don't move if already in hidden container
    if (entry.iframe.parentElement === hiddenContainer) {
      entry.currentContainer = null;
      return;
    }

    try {
      // Use moveBefore if supported
      if (this.isMoveBeforeSupported() && hiddenContainer.moveBefore) {
        hiddenContainer.moveBefore(entry.iframe, null);
      } else {
        // Fallback - this will reload the iframe
        if (entry.iframe.parentElement) {
          entry.iframe.parentElement.removeChild(entry.iframe);
        }
        hiddenContainer.appendChild(entry.iframe);
      }
    } catch (error) {
      console.error("Error unmounting iframe:", error);

      // Fallback to regular appendChild
      if (entry.iframe.parentElement) {
        entry.iframe.parentElement.removeChild(entry.iframe);
      }
      hiddenContainer.appendChild(entry.iframe);
    }

    entry.currentContainer = null;
  }

  /**
   * Remove an iframe completely
   */
  removeIframe(key: string): void {
    const entry = this.iframes.get(key);
    if (!entry) return;

    // Remove iframe from DOM
    if (entry.iframe.parentElement) {
      entry.iframe.parentElement.removeChild(entry.iframe);
    }

    this.iframes.delete(key);
  }

  /**
   * Clean up least recently used iframes when we exceed the limit
   */
  private cleanupOldIframes(): void {
    if (this.iframes.size <= this.maxIframes) return;

    // Sort by last used time and remove oldest unmounted iframes
    const sorted = Array.from(this.iframes.entries())
      .filter(([, entry]) => !entry.currentContainer)
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

    const toRemove = sorted.slice(
      0,
      Math.max(0, this.iframes.size - this.maxIframes)
    );

    for (const [key] of toRemove) {
      this.removeIframe(key);
    }
  }

  /**
   * Preload multiple iframes
   */
  async preloadMultiple(
    entries: Array<{ key: string; url: string }>
  ): Promise<void> {
    await Promise.all(
      entries.map(({ key, url }) => this.preloadIframe(key, url))
    );
  }

  /**
   * Get all currently loaded iframe keys
   */
  getLoadedKeys(): string[] {
    return Array.from(this.iframes.keys());
  }

  /**
   * Clear all iframes
   */
  clear(): void {
    for (const key of this.iframes.keys()) {
      this.removeIframe(key);
    }
  }

  /**
   * Check browser support for moveBefore
   */
  checkBrowserSupport(): { supported: boolean; message: string } {
    if (this.isMoveBeforeSupported()) {
      return {
        supported: true,
        message:
          "moveBefore is supported - iframes will preserve state when moved",
      };
    } else {
      return {
        supported: false,
        message:
          "moveBefore is not supported - iframes will reload when moved. Chrome 133+ is required.",
      };
    }
  }
}

// Export singleton instance
export const iframeManager = new IframeManager();
