import { useEffect, useRef } from "react";
import type { RefObject } from "react";

type FocusableEditor = {
  focus?: () => void;
};

interface UseLexicalFocusPersistenceParams {
  editorRef: RefObject<FocusableEditor | null>;
  rootSelector: string;
  disabled?: boolean;
}

export function useLexicalFocusPersistence({
  editorRef,
  rootSelector,
  disabled = false,
}: UseLexicalFocusPersistenceParams) {
  const lastPointerEventRef = useRef<{
    ts: number;
    target: EventTarget | null;
  }>({
    ts: 0,
    target: null,
  });

  const lastKeydownRef = useRef<{
    ts: number;
    key: string;
    code: string;
  }>({
    ts: 0,
    key: "",
    code: "",
  });

  const pendingRefocusTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const clearPendingRefocus = () => {
      if (pendingRefocusTimeoutRef.current !== null) {
        window.clearTimeout(pendingRefocusTimeoutRef.current);
        pendingRefocusTimeoutRef.current = null;
      }
    };

    const scheduleRefocus = () => {
      clearPendingRefocus();
      pendingRefocusTimeoutRef.current = window.setTimeout(() => {
        pendingRefocusTimeoutRef.current = null;
        editorRef.current?.focus?.();
      }, 0);
    };

    const shouldRestoreFocus = (
      event: FocusEvent,
      candidateActiveElement: Element | null,
    ): boolean => {
      if (!document.hasFocus()) {
        return false;
      }

      const targetElement =
        event.target instanceof Element ? event.target : null;
      if (!targetElement?.closest(rootSelector)) {
        return false;
      }

      if (
        candidateActiveElement &&
        targetElement.contains(candidateActiveElement)
      ) {
        return false;
      }

      const now = Date.now();
      const recentPointer = lastPointerEventRef.current;
      if (
        recentPointer.ts !== 0 &&
        now - recentPointer.ts < 400 &&
        recentPointer.target instanceof Element &&
        !recentPointer.target.closest(rootSelector)
      ) {
        return false;
      }

      const recentKeydown = lastKeydownRef.current;
      if (
        recentKeydown.ts !== 0 &&
        now - recentKeydown.ts < 400 &&
        (recentKeydown.key === "Tab" || recentKeydown.code === "Tab")
      ) {
        return false;
      }

      if (!candidateActiveElement) {
        return true;
      }

      if (
        candidateActiveElement instanceof HTMLIFrameElement &&
        candidateActiveElement.title.toLowerCase().includes("vscode")
      ) {
        return true;
      }

      return candidateActiveElement.tagName === "BODY";
    };

    const handleFocusEvent = (event: FocusEvent) => {
      const activeElement = document.activeElement;
      const shouldRefocusImmediately =
        event.type === "focusout" &&
        shouldRestoreFocus(
          event,
          activeElement instanceof Element ? activeElement : null,
        );

      if (shouldRefocusImmediately) {
        scheduleRefocus();
      }

      queueMicrotask(() => {
        const elementAfterMicrotask = document.activeElement;
        const shouldRefocusAfterMicrotask =
          event.type === "focusout" &&
          shouldRestoreFocus(
            event,
            elementAfterMicrotask instanceof Element
              ? elementAfterMicrotask
              : null,
          );

        if (shouldRefocusAfterMicrotask) {
          scheduleRefocus();
        }
      });
    };

    const handlePointerEvent = (event: PointerEvent) => {
      lastPointerEventRef.current = {
        ts: Date.now(),
        target: event.target,
      };
    };

    const handleKeyEvent = (event: KeyboardEvent) => {
      if (event.type === "keydown") {
        lastKeydownRef.current = {
          ts: Date.now(),
          key: event.key,
          code: event.code,
        };
      }
    };

    document.addEventListener("focusin", handleFocusEvent, true);
    document.addEventListener("focusout", handleFocusEvent, true);
    document.addEventListener("pointerdown", handlePointerEvent, true);
    document.addEventListener("pointerup", handlePointerEvent, true);
    document.addEventListener("keydown", handleKeyEvent, true);
    document.addEventListener("keyup", handleKeyEvent, true);

    return () => {
      clearPendingRefocus();
      document.removeEventListener("focusin", handleFocusEvent, true);
      document.removeEventListener("focusout", handleFocusEvent, true);
      document.removeEventListener("pointerdown", handlePointerEvent, true);
      document.removeEventListener("pointerup", handlePointerEvent, true);
      document.removeEventListener("keydown", handleKeyEvent, true);
      document.removeEventListener("keyup", handleKeyEvent, true);
    };
  }, [disabled, editorRef, rootSelector]);
}
