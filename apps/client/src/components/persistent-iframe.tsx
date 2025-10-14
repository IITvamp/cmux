import type { CSSProperties } from "react";
import { useEffect } from "react";

import { usePersistentIframe } from "../hooks/usePersistentIframe";
import { cn } from "@/lib/utils";

interface PersistentIframeProps {
  persistKey: string;
  src: string;
  className?: string;
  style?: CSSProperties;
  preload?: boolean;
  allow?: string;
  sandbox?: string;
  iframeClassName?: string;
  iframeStyle?: CSSProperties;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export function PersistentIframe({
  persistKey,
  src,
  className,
  style,
  preload,
  allow,
  sandbox,
  iframeClassName,
  iframeStyle,
  onLoad,
  onError,
  onLoadingChange,
}: PersistentIframeProps) {
  const { containerRef, isLoading } = usePersistentIframe({
    key: persistKey,
    url: src,
    preload,
    allow,
    sandbox,
    className: iframeClassName,
    style: iframeStyle,
    onLoad,
    onError,
  });

  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  return <div ref={containerRef} className={cn(className)} style={style} />;
}
