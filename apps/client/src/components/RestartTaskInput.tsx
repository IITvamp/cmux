import LexicalEditor from "@/components/lexical/LexicalEditor";
import type { Id } from "@cmux/convex/dataModel";
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export interface EditorApi {
  getContent: () => {
    text: string;
    images: Array<{
      src: string;
      fileName?: string;
      altText: string;
    }>;
  };
  clear: () => void;
  focus?: () => void;
  insertText?: (text: string) => void;
}

interface RestartTaskInputProps {
  placeholder?: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  repoUrl?: string;
  branch?: string;
  environmentId?: Id<"environments">;
  persistenceKey?: string;
  maxHeight?: string;
  minHeight?: string;
  contentEditableClassName?: string;
  padding?: React.CSSProperties;
}

export const RestartTaskInput = memo(
  forwardRef<EditorApi, RestartTaskInputProps>(function RestartTaskInput(
    {
      placeholder,
      onChange,
      onSubmit,
      repoUrl,
      branch,
      environmentId,
      persistenceKey,
      maxHeight = "300px",
      minHeight = "30px",
      contentEditableClassName,
      padding,
    },
    ref
  ) {
    const internalApiRef = useRef<EditorApi | null>(null);
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
    const pendingRefocusTimeoutRef = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      getContent: () =>
        internalApiRef.current?.getContent() || { text: "", images: [] },
      clear: () => internalApiRef.current?.clear(),
      focus: () => internalApiRef.current?.focus?.(),
      insertText: (text: string) => internalApiRef.current?.insertText?.(text),
    }));

    useEffect(() => {
      // Use a more specific selector for the restart task input
      const lexicalRootSelector = ".restart-task-input-editor";

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
          internalApiRef.current?.focus?.();
        }, 0);
      };

      const shouldRestoreFocus = (
        event: FocusEvent,
        candidateActiveElement: Element | null
      ) => {
        if (!document.hasFocus()) {
          return false;
        }

        const targetElement =
          event.target instanceof Element ? event.target : null;
        if (!targetElement?.closest(lexicalRootSelector)) {
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
          !recentPointer.target.closest(lexicalRootSelector)
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

        // Check if focus was stolen by an iframe (especially VSCode)
        if (
          candidateActiveElement instanceof HTMLIFrameElement &&
          (candidateActiveElement.title.toLowerCase().includes("vscode") ||
           candidateActiveElement.title.toLowerCase().includes("openvscode"))
        ) {
          return true;
        }

        // Check if focus is on body (lost focus)
        return candidateActiveElement.tagName === "BODY";
      };

      const handleFocusEvent = (event: FocusEvent) => {
        const activeElement = document.activeElement;
        const shouldRefocusImmediately =
          event.type === "focusout" &&
          shouldRestoreFocus(
            event,
            activeElement instanceof Element ? activeElement : null
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
                : null
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
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
          };
        }
      };

      // Listen to focus events at document level to catch focus loss
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
    }, []);

    const handleEditorReady = (api: EditorApi) => {
      internalApiRef.current = api;
    };

    return (
      <div className="restart-task-input-editor">
        <LexicalEditor
          placeholder={placeholder}
          onChange={onChange}
          onSubmit={onSubmit}
          repoUrl={repoUrl}
          branch={branch}
          environmentId={environmentId}
          persistenceKey={persistenceKey}
          padding={padding}
          contentEditableClassName={contentEditableClassName}
          maxHeight={maxHeight}
          minHeight={minHeight}
          onEditorReady={handleEditorReady}
        />
      </div>
    );
  })
);