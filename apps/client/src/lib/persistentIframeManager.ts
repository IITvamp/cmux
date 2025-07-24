// Extend the Element interface to include moveBefore
declare global {
  interface Element {
    moveBefore?(node: Node, child: Node | null): void;
  }
}

type IframeEntry = {
  iframe: HTMLIFrameElement;
  wrapper: HTMLDivElement;
  url: string;
  lastUsed: number;
  isVisible: boolean;
};

interface MountOptions {
  className?: string;
  style?: React.CSSProperties;
  allow?: string;
}

/**
 * PersistentIframeManager uses a different approach:
 * - All iframes stay in a persistent container
 * - We use CSS to position them over the target container
 * - This avoids DOM moves entirely, preventing reload
 */
class PersistentIframeManager {
  private iframes = new Map<string, IframeEntry>();
  private maxIframes = 10;
  private container: HTMLDivElement | null = null;
  private resizeObserver: ResizeObserver;
  private activeIframeKey: string | null = null;
  private debugMode = true; // Set to true to enable logging

  constructor() {
    // Create resize observer for syncing positions
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const key = entry.target.getAttribute("data-iframe-target");
        if (key) {
          if (this.debugMode)
            console.log(`[ResizeObserver] Syncing position for ${key}`);
          this.syncIframePosition(key);
        }
      }
    });

    this.initializeContainer();
  }

  private initializeContainer() {
    if (typeof document === "undefined") return;

    const init = () => {
      this.container = document.createElement("div");
      this.container.id = "persistent-iframe-container";
      this.container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        pointer-events: none;
        z-index: 9999;
      `;
      document.body.appendChild(this.container);
    };

    if (document.body) {
      init();
    } else {
      document.addEventListener("DOMContentLoaded", init);
    }
  }

  /**
   * Get or create an iframe
   */
  getOrCreateIframe(key: string, url: string, options?: { allow?: string }): HTMLIFrameElement {
    const existing = this.iframes.get(key);

    if (existing) {
      existing.lastUsed = Date.now();
      if (existing.url !== url) {
        existing.iframe.src = url;
        existing.url = url;
      }
      return existing.iframe;
    }

    // Create wrapper div
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      position: fixed;
      visibility: hidden;
      pointer-events: none;
      overflow: hidden;
    `;
    wrapper.setAttribute("data-iframe-key", key);

    // Create iframe
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: 0;
    `;
    
    // Apply permissions if provided
    if (options?.allow) {
      iframe.allow = options.allow;
    }

    wrapper.appendChild(iframe);

    // Add to container
    if (this.container) {
      this.container.appendChild(wrapper);
    }

    const entry: IframeEntry = {
      iframe,
      wrapper,
      url,
      lastUsed: Date.now(),
      isVisible: false,
    };

    this.iframes.set(key, entry);
    this.cleanupOldIframes();

    return iframe;
  }

  /**
   * Show iframe over a target element
   */
  mountIframe(
    key: string,
    targetElement: HTMLElement,
    options?: MountOptions
  ): () => void {
    if (this.debugMode) console.log(`[Mount] Starting mount for ${key}`);

    const entry = this.iframes.get(key);
    if (!entry) {
      throw new Error(`Iframe with key "${key}" not found`);
    }

    // Fix #1: Hide currently active iframe before showing new one
    if (this.activeIframeKey && this.activeIframeKey !== key) {
      const activeEntry = this.iframes.get(this.activeIframeKey);
      if (activeEntry && activeEntry.isVisible) {
        if (this.debugMode)
          console.log(`[Mount] Hiding active iframe ${this.activeIframeKey}`);
        activeEntry.wrapper.style.visibility = "hidden";
        activeEntry.wrapper.style.pointerEvents = "none";
        activeEntry.isVisible = false;
      }
    }

    // Mark target element
    targetElement.setAttribute("data-iframe-target", key);

    // Apply styles to wrapper
    if (options?.className) {
      entry.wrapper.className = options.className;
    }

    // First sync position while hidden
    this.syncIframePosition(key);

    // Then make visible after a microtask to ensure position is set
    Promise.resolve().then(() => {
      if (options?.style) {
        // Convert React.CSSProperties to CSS string, preserving existing fixed positioning
        const styleEntries = Object.entries(options.style);
        const additionalStyles = styleEntries
          .map(([key, value]) => {
            // Convert camelCase to kebab-case
            const cssKey = key.replace(
              /[A-Z]/g,
              (match) => `-${match.toLowerCase()}`
            );
            return `${cssKey}: ${value}`;
          })
          .join("; ");

        // Preserve core positioning while adding custom styles
        entry.wrapper.style.cssText = `
          position: fixed;
          visibility: visible;
          pointer-events: auto;
          overflow: hidden;
          ${additionalStyles}
        `;
      } else {
        // Default styles
        entry.wrapper.style.cssText = `
          position: fixed;
          visibility: visible;
          pointer-events: auto;
          overflow: hidden;
        `;
      }

      entry.isVisible = true;
      this.activeIframeKey = key;
      if (this.debugMode) console.log(`[Mount] Iframe ${key} is now visible`);
    });

    entry.lastUsed = Date.now();

    // Start observing the target element
    this.resizeObserver.observe(targetElement);

    // Listen for scroll events
    const scrollHandler = () => {
      if (this.debugMode) console.log(`[Scroll] Syncing position for ${key}`);
      this.syncIframePosition(key);
    };
    const scrollableParents = this.getScrollableParents(targetElement);
    scrollableParents.forEach((parent) => {
      parent.addEventListener("scroll", scrollHandler, { passive: true });
    });

    // Also sync on window resize
    window.addEventListener("resize", scrollHandler);

    // Return cleanup function
    return () => {
      if (this.debugMode) console.log(`[Unmount] Starting unmount for ${key}`);

      targetElement.removeAttribute("data-iframe-target");
      entry.wrapper.style.visibility = "hidden";
      entry.wrapper.style.pointerEvents = "none";
      entry.isVisible = false;

      if (this.activeIframeKey === key) {
        this.activeIframeKey = null;
      }

      this.resizeObserver.unobserve(targetElement);
      scrollableParents.forEach((parent) => {
        parent.removeEventListener("scroll", scrollHandler);
      });
      window.removeEventListener("resize", scrollHandler);
    };
  }

  /**
   * Sync iframe position with target element
   */
  private syncIframePosition(key: string) {
    const entry = this.iframes.get(key);
    if (!entry) return;

    const targetElement = document.querySelector(
      `[data-iframe-target="${key}"]`
    ) as HTMLElement;
    if (!targetElement) return;

    const rect = targetElement.getBoundingClientRect();

    // Update wrapper position
    entry.wrapper.style.top = `${rect.top}px`;
    entry.wrapper.style.left = `${rect.left}px`;
    entry.wrapper.style.width = `${rect.width}px`;
    entry.wrapper.style.height = `${rect.height}px`;
  }

  /**
   * Get all scrollable parent elements
   */
  private getScrollableParents(element: HTMLElement): HTMLElement[] {
    const parents: HTMLElement[] = [];
    let current = element.parentElement;

    while (current) {
      const style = window.getComputedStyle(current);
      if (
        style.overflow === "auto" ||
        style.overflow === "scroll" ||
        style.overflowX === "auto" ||
        style.overflowX === "scroll" ||
        style.overflowY === "auto" ||
        style.overflowY === "scroll"
      ) {
        parents.push(current);
      }
      current = current.parentElement;
    }

    // Always include window
    parents.push(document.documentElement);

    return parents;
  }

  /**
   * Hide iframe
   */
  unmountIframe(key: string): void {
    const entry = this.iframes.get(key);
    if (!entry) return;

    entry.wrapper.style.visibility = "hidden";
    entry.wrapper.style.pointerEvents = "none";
    entry.isVisible = false;

    if (this.activeIframeKey === key) {
      this.activeIframeKey = null;
    }
  }

  /**
   * Preload an iframe
   */
  preloadIframe(key: string, url: string, options?: { allow?: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      const iframe = this.getOrCreateIframe(key, url, options);

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

      if (iframe.contentWindow && iframe.src === url) {
        resolve();
        return;
      }

      iframe.addEventListener("load", handleLoad);
      iframe.addEventListener("error", handleError);
    });
  }

  /**
   * Remove an iframe completely
   */
  removeIframe(key: string): void {
    const entry = this.iframes.get(key);
    if (!entry) return;

    if (entry.wrapper.parentElement) {
      entry.wrapper.parentElement.removeChild(entry.wrapper);
    }

    this.iframes.delete(key);
  }

  /**
   * Clean up old iframes
   */
  private cleanupOldIframes(): void {
    if (this.iframes.size <= this.maxIframes) return;

    const sorted = Array.from(this.iframes.entries())
      .filter(([, entry]) => !entry.isVisible)
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
    entries: Array<{ key: string; url: string; allow?: string }>
  ): Promise<void> {
    await Promise.all(
      entries.map(({ key, url, allow }) => this.preloadIframe(key, url, { allow }))
    );
  }

  /**
   * Get all loaded iframe keys
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
   * Enable or disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}

// Export singleton instance
export const persistentIframeManager = new PersistentIframeManager();
