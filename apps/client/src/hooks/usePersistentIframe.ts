import { useCallback, useEffect, useRef, useState } from "react";
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

  /**
   * Permissions for the iframe (e.g., "clipboard-read", "clipboard-write")
   */
  allow?: string;

  /**
   * Sandbox attribute for the iframe
   */
  sandbox?: string;
}

export function usePersistentIframe({
  key,
  url,
  preload = false,
  onLoad,
  onError,
  className,
  style,
  allow,
  sandbox,
}: UsePersistentIframeOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Preload effect
  useEffect(() => {
    if (preload) {
      setIsLoading(true);
      persistentIframeManager
        .preloadIframe(key, url, { allow, sandbox })
        .then(() => {
          setIsLoading(false);
          onLoad?.();
        })
        .catch((error) => {
          setIsLoading(false);
          onError?.(error);
        });
    }
  }, [key, url, preload, allow, sandbox, onLoad, onError]);

  // Mount/unmount effect
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      // Get or create the iframe
      const iframe = persistentIframeManager.getOrCreateIframe(key, url, { allow, sandbox });

      // Set up load handlers if not already loaded
      if (!iframe.contentWindow || iframe.src !== url) {
        setIsLoading(true);
        const handleLoad = () => {
          iframe.removeEventListener("load", handleLoad);
          iframe.removeEventListener("error", handleError);
          setIsLoading(false);
          onLoad?.();
        };

        const handleError = () => {
          iframe.removeEventListener("load", handleLoad);
          iframe.removeEventListener("error", handleError);
          setIsLoading(false);
          onError?.(new Error(`Failed to load iframe: ${url}`));
        };

        iframe.addEventListener("load", handleLoad);
        iframe.addEventListener("error", handleError);
      } else if (!preload) {
        // Already loaded and not from preload
        setIsLoading(false);
        onLoad?.();
      }

      // Mount the iframe (returns cleanup function)
      cleanupRef.current = persistentIframeManager.mountIframe(
        key,
        containerRef.current,
        {
          className,
          style,
          allow,
          sandbox,
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
  }, [key, url, className, style, allow, sandbox, onLoad, onError, preload]);

  const handlePreload = useCallback(() => {
    return persistentIframeManager.preloadIframe(key, url, { allow, sandbox });
  }, [key, url, allow, sandbox]);

  const handleRemove = useCallback(() => {
    persistentIframeManager.removeIframe(key);
  }, [key]);

  const handleIsLoaded = useCallback(() => {
    try {
      const iframe = persistentIframeManager.getOrCreateIframe(key, url, { allow, sandbox });
      return iframe.contentWindow !== null && iframe.src === url;
    } catch {
      return false;
    }
  }, [key, url, allow, sandbox]);

  return {
    containerRef,
    preload: handlePreload,
    remove: handleRemove,
    isLoaded: handleIsLoaded,
    isLoading,
  };
}
