import { useEffect, useRef } from "react";

interface FocusGuardOptions {
  rootSelector: string;
  focusEditor: () => void;
  debugName?: string;
}

const describeElement = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return target ? String(target) : "<null>";
  }

  const id = target.id ? `#${target.id}` : "";
  const className = target.className
    ? `.${target.className.toString().trim().replace(/\s+/g, ".")}`
    : "";
  const title =
    target instanceof HTMLIFrameElement && target.title
      ? `(${target.title})`
      : "";

  return `${target.tagName.toLowerCase()}${id}${className}${title}`;
};

export function useLexicalFocusGuard({
  rootSelector,
  focusEditor,
  debugName,
}: FocusGuardOptions) {
  const pendingRefocusTimeoutRef = useRef<number | null>(null);
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
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
  }>({
    ts: 0,
    key: "",
    code: "",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
  });

  useEffect(() => {
    const isDev = false;

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
        focusEditor();
      }, 0);
    };

    const shouldRestoreFocus = (
      event: FocusEvent,
      candidateActiveElement: Element | null,
    ) => {
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

      if (isDev && debugName) {
        const payload = {
          eventTarget: describeElement(event.target),
          relatedTarget: describeElement(event.relatedTarget),
          activeElement: describeElement(activeElement),
          timestamp: new Date().toISOString(),
          hasDocumentFocus: document.hasFocus(),
        };
        console.log(`[${debugName}] focus event`, event.type, payload);
        if (event.type === "focusout") {
          console.trace(`[${debugName}] focusout stack trace`);
        }
      }

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

        if (isDev && debugName) {
          console.log(
            `[${debugName}] activeElement after microtask`,
            event.type,
            {
              activeElement: describeElement(elementAfterMicrotask),
              timestamp: new Date().toISOString(),
              hasDocumentFocus: document.hasFocus(),
            },
          );
        }

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

      if (isDev && debugName) {
        console.log(`[${debugName}] pointer event`, event.type, {
          eventTarget: describeElement(event.target),
          pointerType: event.pointerType,
          buttons: event.buttons,
          clientX: event.clientX,
          clientY: event.clientY,
          activeElement: describeElement(document.activeElement),
          timestamp: new Date().toISOString(),
        });
      }
    };

    const handleKeyEvent = (event: KeyboardEvent) => {
      if (event.type === "keydown") {
        lastKeydownRef.current = {
          ts: Date.now(),
          key: event.key,
          code: event.code,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
        };
      }

      if (isDev && debugName) {
        console.log(`[${debugName}] keyboard event`, event.type, {
          key: event.key,
          code: event.code,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          eventTarget: describeElement(event.target),
          activeElement: describeElement(document.activeElement),
          timestamp: new Date().toISOString(),
        });
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
  }, [debugName, focusEditor, rootSelector]);
}

