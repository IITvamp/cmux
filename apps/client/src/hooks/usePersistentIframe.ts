import { useCallback, useEffect, useRef } from "react";
import { persistentIframeManager } from "../lib/persistentIframeManager";

interface UsePersistentIframeOptions {
  /**
   * Unique key to identify this iframe instance
   */
  key: string;

  /**
   * URL to load in the iframe
   */
  url: string;

  /**
   * Whether to preload the iframe before mounting (default: false)
   */
  preload?: boolean;

  /**
   * Callback when iframe is loaded
   */
  onLoad?: () => void;

  /**
   * Callback when iframe fails to load
   */
  onError?: (error: Error) => void;

  /**
   * CSS class names to apply to the iframe
   */
  className?: string;

  /**
   * Inline styles to apply to the iframe
   */
  style?: React.CSSProperties;
}

export function usePersistentIframe({
  key,
  url,
  preload = false,
  onLoad,
  onError,
  className,
  style,
}: UsePersistentIframeOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Preload effect
  useEffect(() => {
    if (preload) {
      persistentIframeManager
        .preloadIframe(key, url)
        .then(() => onLoad?.())
        .catch((error) => onError?.(error));
    }
  }, [key, url, preload]); // Remove callbacks from deps

  // Mount/unmount effect
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      // Get or create the iframe
      const iframe = persistentIframeManager.getOrCreateIframe(key, url);

      // Set up load handlers if not already loaded
      if (!iframe.contentWindow || iframe.src !== url) {
        const handleLoad = () => {
          iframe.removeEventListener("load", handleLoad);
          iframe.removeEventListener("error", handleError);
          onLoad?.();
        };

        const handleError = () => {
          iframe.removeEventListener("load", handleLoad);
          iframe.removeEventListener("error", handleError);
          onError?.(new Error(`Failed to load iframe: ${url}`));
        };

        iframe.addEventListener("load", handleLoad);
        iframe.addEventListener("error", handleError);
      } else if (!preload) {
        // Already loaded and not from preload
        onLoad?.();
      }

      // Mount the iframe (returns cleanup function)
      cleanupRef.current = persistentIframeManager.mountIframe(
        key,
        containerRef.current,
        {
          className,
          style,
        }
      );
    } catch (error) {
      console.error("Error mounting iframe:", error);
      onError?.(error as Error);
    }

    // Cleanup
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [key, url, className, style]); // Add className and style to deps

  const handlePreload = useCallback(() => {
    return persistentIframeManager.preloadIframe(key, url);
  }, [key, url]);

  const handleRemove = useCallback(() => {
    persistentIframeManager.removeIframe(key);
  }, [key]);

  const handleIsLoaded = useCallback(() => {
    try {
      const iframe = persistentIframeManager.getOrCreateIframe(key, url);
      return iframe.contentWindow !== null && iframe.src === url;
    } catch {
      return false;
    }
  }, [key, url]);

  return {
    containerRef,
    preload: handlePreload,
    remove: handleRemove,
    isLoaded: handleIsLoaded,
  };
}
