import LexicalEditor from "@/components/lexical/LexicalEditor";
import clsx from "clsx";
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
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

interface DashboardInputProps {
  onTaskDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  repoUrl?: string;
  branch?: string;
  persistenceKey?: string;
  maxHeight?: string;
}

const CMUX_INPUT_SELECTOR = '[data-cmux-input="true"]';

const isElement = (target: EventTarget | null): target is Element => {
  return target instanceof Element;
};

const findEditorElement = (target: EventTarget | null): Element | null => {
  if (!isElement(target)) {
    return null;
  }

  if (target.matches(CMUX_INPUT_SELECTOR)) {
    return target;
  }

  if ("closest" in target) {
    return target.closest(CMUX_INPUT_SELECTOR);
  }

  return null;
};

const describeFocusTarget = (target: EventTarget | Element | null): string => {
  if (!target) {
    return "null";
  }

  if (target instanceof Element) {
    const tag = target.tagName.toLowerCase();
    const idPart = target.id ? `#${target.id}` : "";
    const classes = Array.from(target.classList).slice(0, 3);
    const classPart = classes.length > 0 ? `.${classes.join(".")}` : "";
    const hasCmuxFlag =
      target instanceof HTMLElement && target.dataset.cmuxInput === "true";
    const cmuxFlag = hasCmuxFlag ? "[data-cmux-input]" : "";
    const namePart =
      target instanceof HTMLInputElement && target.name
        ? `[name=${target.name}]`
        : "";
    const typePart =
      target instanceof HTMLInputElement && target.type
        ? `[type=${target.type}]`
        : "";

    return `${tag}${idPart}${classPart}${cmuxFlag}${namePart}${typePart}`;
  }

  return String(target);
};

export const DashboardInput = memo(
  forwardRef<EditorApi, DashboardInputProps>(function DashboardInput(
    {
      onTaskDescriptionChange,
      onSubmit,
      repoUrl,
      branch,
      persistenceKey,
      maxHeight = "600px",
    },
    ref
  ) {
    const internalApiRef = useRef<EditorApi | null>(null);

    const logPrefix = useMemo(() => {
      const suffix = persistenceKey ? ` (${persistenceKey})` : "";
      return `[DashboardInput focus debug${suffix}]`;
    }, [persistenceKey]);

    useImperativeHandle(ref, () => ({
      getContent: () => internalApiRef.current?.getContent() || { text: "", images: [] },
      clear: () => internalApiRef.current?.clear(),
      focus: () => {
        if (typeof document !== "undefined") {
          console.log(`${logPrefix} focus() called`, {
            timestamp: new Date().toISOString(),
            activeElementBefore: describeFocusTarget(document.activeElement),
            activeElementNode: document.activeElement,
          });
        } else {
          console.log(`${logPrefix} focus() called`);
        }
        internalApiRef.current?.focus?.();
      },
      insertText: (text: string) => internalApiRef.current?.insertText?.(text),
    }));

    const lexicalPlaceholder = useMemo(() => "Describe a task", []);

    const lexicalPadding = useMemo(
      () => ({
        paddingLeft: "14px",
        paddingRight: "16px",
        paddingTop: "14px",
      }),
      []
    );

    const lexicalClassName = useMemo(
      () =>
        clsx(
          "text-[15px] text-neutral-900 dark:text-neutral-100 min-h-[60px]!",
          "focus:outline-none"
        ),
      []
    );

    const handleEditorReady = (api: EditorApi) => {
      internalApiRef.current = api;
      if (typeof document !== "undefined") {
        console.log(`${logPrefix} editor ready`, {
          timestamp: new Date().toISOString(),
          activeElement: describeFocusTarget(document.activeElement),
          activeElementNode: document.activeElement,
        });
      } else {
        console.log(`${logPrefix} editor ready`);
      }
    };

    useEffect(() => {
      if (typeof document === "undefined") {
        return;
      }

      const logFocusEvent = (phase: "focusin" | "focusout", event: FocusEvent) => {
        const activeElement = document.activeElement;
        console.log(`${logPrefix} ${phase}`, {
          timestamp: new Date().toISOString(),
          eventTarget: describeFocusTarget(event.target),
          relatedTarget: describeFocusTarget(event.relatedTarget),
          activeElement: describeFocusTarget(activeElement),
          eventTargetNode: isElement(event.target) ? event.target : null,
          relatedTargetNode: isElement(event.relatedTarget) ? event.relatedTarget : null,
          activeElementNode: activeElement,
        });
      };

      const handleFocusIn = (event: FocusEvent) => {
        const targetIsEditor = findEditorElement(event.target);
        const relatedIsEditor = findEditorElement(event.relatedTarget);

        if (!targetIsEditor && !relatedIsEditor) {
          return;
        }

        logFocusEvent("focusin", event);
      };

      const handleFocusOut = (event: FocusEvent) => {
        if (!findEditorElement(event.target)) {
          return;
        }

        logFocusEvent("focusout", event);

        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => {
            const activeElement = document.activeElement;
            console.log(`${logPrefix} focusout (after frame)`, {
              timestamp: new Date().toISOString(),
              activeElement: describeFocusTarget(activeElement),
              activeElementNode: activeElement,
              previousEventTarget: isElement(event.target) ? event.target : null,
              newFocusCandidate: isElement(event.relatedTarget)
                ? event.relatedTarget
                : null,
            });
          });
        }
      };

      document.addEventListener("focusin", handleFocusIn);
      document.addEventListener("focusout", handleFocusOut);

      console.log(`${logPrefix} focus listeners attached`);

      return () => {
        document.removeEventListener("focusin", handleFocusIn);
        document.removeEventListener("focusout", handleFocusOut);
        console.log(`${logPrefix} focus listeners detached`);
      };
    }, [logPrefix]);

    return (
      <LexicalEditor
        placeholder={lexicalPlaceholder}
        onChange={onTaskDescriptionChange}
        onSubmit={onSubmit}
        repoUrl={repoUrl}
        branch={branch}
        persistenceKey={persistenceKey}
        padding={lexicalPadding}
        contentEditableClassName={lexicalClassName}
        maxHeight={maxHeight}
        onEditorReady={handleEditorReady}
      />
    );
  })
);
