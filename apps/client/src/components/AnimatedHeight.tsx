import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface AnimatedHeightProps {
  isExpanded: boolean;
  children: ReactNode;
  duration?: number;
  easing?: string;
  className?: string;
}

export function AnimatedHeight({
  isExpanded,
  children,
  duration = 200,
  easing = "cubic-bezier(0.4, 0, 0.2, 1)",
  className = "",
}: AnimatedHeightProps) {
  const [height, setHeight] = useState<number | "auto">(isExpanded ? "auto" : 0);
  const [isAnimating, setIsAnimating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateHeight = useCallback(() => {
    if (!contentRef.current) return;

    const contentHeight = contentRef.current.scrollHeight;

    if (isExpanded) {
      // Expanding: transition from 0 (or current) to full height
      if (height === 0 || height === "auto") {
        setHeight(0);
        setIsAnimating(true);

        // Force a reflow to ensure the height change is applied
        contentRef.current.offsetHeight;

        animationFrameRef.current = requestAnimationFrame(() => {
          setHeight(contentHeight);
          timeoutRef.current = setTimeout(() => {
            setHeight("auto");
            setIsAnimating(false);
          }, duration);
        });
      }
    } else {
      // Collapsing: transition from full height to 0
      if (height === "auto" || typeof height === "number") {
        setHeight(contentHeight);
        setIsAnimating(true);

        // Force a reflow to ensure the height change is applied
        contentRef.current.offsetHeight;

        animationFrameRef.current = requestAnimationFrame(() => {
          setHeight(0);
          timeoutRef.current = setTimeout(() => {
            setIsAnimating(false);
          }, duration);
        });
      }
    }
  }, [isExpanded, height, duration]);

  useEffect(() => {
    updateHeight();

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isExpanded, updateHeight]);

  // Handle dynamic content changes
  useEffect(() => {
    if (!contentRef.current || !isExpanded || height === 0) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isExpanded && !isAnimating && height === "auto") {
        // Update the height instantly when content changes and we're expanded
        const newHeight = contentRef.current?.scrollHeight;
        if (newHeight) {
          setHeight("auto");
        }
      }
    });

    resizeObserver.observe(contentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isExpanded, height, isAnimating]);

  return (
    <div
      className={className}
      style={{
        height: height === "auto" ? "auto" : `${height}px`,
        transition: isAnimating ? `height ${duration}ms ${easing}` : "none",
        overflow: "hidden",
        willChange: isAnimating ? "height" : "auto",
      }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}