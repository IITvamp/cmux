import LexicalEditor from "@/components/lexical/LexicalEditor";
import clsx from "clsx";
import { forwardRef, memo, useImperativeHandle, useRef, useMemo } from "react";

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
}

export const DashboardInput = memo(
  forwardRef<EditorApi, DashboardInputProps>(function DashboardInput(
    {
      onTaskDescriptionChange,
      onSubmit,
      repoUrl,
      branch,
    },
    ref
  ) {
    const internalApiRef = useRef<EditorApi | null>(null);

    useImperativeHandle(ref, () => ({
      getContent: () => internalApiRef.current?.getContent() || { text: "", images: [] },
      clear: () => internalApiRef.current?.clear(),
      focus: () => internalApiRef.current?.focus?.(),
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
          "text-[15px] text-neutral-900 dark:text-neutral-100 min-h-[60px]! max-h-[600px]",
          "focus:outline-none"
        ),
      []
    );

    const handleEditorReady = (api: EditorApi) => {
      internalApiRef.current = api;
    };

    return (
      <LexicalEditor
        placeholder={lexicalPlaceholder}
        onChange={onTaskDescriptionChange}
        onSubmit={onSubmit}
        repoUrl={repoUrl}
        branch={branch}
        padding={lexicalPadding}
        contentEditableClassName={lexicalClassName}
        onEditorReady={handleEditorReady}
      />
    );
  })
);