import clsx from "clsx";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from "react";

interface SmoothCollapseProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  unmountOnExit?: boolean;
}

function measureHeight(element: HTMLDivElement | null): number {
  if (!element) {
    return 0;
  }

  const { height } = element.getBoundingClientRect();
  return Math.max(0, Math.ceil(height));
}

export function SmoothCollapse({
  isOpen,
  unmountOnExit = false,
  children,
  className,
  style,
  ...rest
}: SmoothCollapseProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(() => measureHeight(contentRef.current));
  const [rendered, setRendered] = useState<boolean>(isOpen || !unmountOnExit);

  useLayoutEffect(() => {
    if (!rendered) {
      return;
    }

    const contentEl = contentRef.current;
    if (!contentEl) {
      return;
    }

    let frameId: number | null = null;

    const updateHeight = () => {
      frameId = null;
      setHeight(measureHeight(contentEl));
    };

    updateHeight();

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          if (frameId !== null) {
            return;
          }
          frameId = requestAnimationFrame(updateHeight);
        })
      : null;

    if (observer) {
      observer.observe(contentEl);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };
  }, [rendered, children]);

  useLayoutEffect(() => {
    if (isOpen) {
      setRendered(true);
      return;
    }

    if (!unmountOnExit) {
      return;
    }

    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) {
      setRendered(false);
      return;
    }

    let isFinished = false;
    let fallbackTimeout: number | null = null;

    const finish = () => {
      if (isFinished) {
        return;
      }
      isFinished = true;
      setRendered(false);
    };

    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target === wrapperEl && event.propertyName === "max-height") {
        if (fallbackTimeout !== null && typeof window !== "undefined") {
          window.clearTimeout(fallbackTimeout);
          fallbackTimeout = null;
        }
        finish();
      }
    };

    wrapperEl.addEventListener("transitionend", handleTransitionEnd);

    if (typeof window === "undefined") {
      finish();
      return () => {
        wrapperEl.removeEventListener("transitionend", handleTransitionEnd);
      };
    }

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const fallbackDelay = prefersReducedMotion ? 0 : 360;

    fallbackTimeout = window.setTimeout(() => {
      wrapperEl.removeEventListener("transitionend", handleTransitionEnd);
      finish();
    }, fallbackDelay);

    return () => {
      wrapperEl.removeEventListener("transitionend", handleTransitionEnd);
      if (fallbackTimeout !== null) {
        window.clearTimeout(fallbackTimeout);
      }
      isFinished = true;
    };
  }, [isOpen, unmountOnExit]);

  if (!rendered && unmountOnExit) {
    return null;
  }

  const resolvedHeight = isOpen ? `${height}px` : "0px";
  const resolvedPointerEvents = isOpen
    ? style?.pointerEvents ?? "auto"
    : "none";

  const mergedStyle: CSSProperties = {
    ...style,
    maxHeight: resolvedHeight,
    opacity: isOpen ? 1 : 0,
    pointerEvents: resolvedPointerEvents,
  };

  return (
    <div
      ref={wrapperRef}
      data-state={isOpen ? "open" : "closed"}
      aria-hidden={!isOpen}
      className={clsx(
        "overflow-hidden motion-safe:transition-[max-height,opacity] motion-safe:duration-300 motion-safe:ease-in-out",
        "will-change-[max-height,opacity]",
        className
      )}
      style={mergedStyle}
      {...rest}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
