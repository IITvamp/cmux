import {
  $createParagraphNode,
  $getRoot,
  type SerializedEditorState,
} from "lexical";

import { CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { TRANSFORMERS } from "@lexical/markdown";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import clsx from "clsx";
import { COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND } from "lexical";
import { useEffect, useRef } from "react";
import { EditorStatePlugin } from "./EditorStatePlugin";
import { ImageNode } from "./ImageNode";
import { ImagePlugin } from "./ImagePlugin";
import { MentionPlugin } from "./MentionPlugin";

const theme = {
  ltr: "ltr",
  rtl: "rtl",
  paragraph: "editor-paragraph",
  quote: "editor-quote",
  heading: {
    h1: "editor-heading-h1",
    h2: "editor-heading-h2",
    h3: "editor-heading-h3",
    h4: "editor-heading-h4",
    h5: "editor-heading-h5",
  },
  list: {
    nested: {
      listitem: "editor-nested-listitem",
    },
    ol: "editor-list-ol",
    ul: "editor-list-ul",
    listitem: "editor-listitem",
  },
  image: "editor-image",
  link: "editor-link",
  text: {
    bold: "editor-text-bold",
    italic: "editor-text-italic",
    overflowed: "editor-text-overflowed",
    hashtag: "editor-text-hashtag",
    underline: "editor-text-underline",
    strikethrough: "editor-text-strikethrough",
    underlineStrikethrough: "editor-text-underlineStrikethrough",
    code: "editor-text-code",
  },
  code: "editor-code",
  codeHighlight: {
    atrule: "editor-tokenAttr",
    attr: "editor-tokenAttr",
    boolean: "editor-tokenProperty",
    builtin: "editor-tokenSelector",
    cdata: "editor-tokenComment",
    char: "editor-tokenSelector",
    class: "editor-tokenFunction",
    className: "editor-tokenFunction",
    comment: "editor-tokenComment",
    constant: "editor-tokenProperty",
    deleted: "editor-tokenProperty",
    doctype: "editor-tokenComment",
    entity: "editor-tokenOperator",
    function: "editor-tokenFunction",
    important: "editor-tokenVariable",
    inserted: "editor-tokenSelector",
    keyword: "editor-tokenAttr",
    namespace: "editor-tokenVariable",
    number: "editor-tokenProperty",
    operator: "editor-tokenOperator",
    prolog: "editor-tokenComment",
    property: "editor-tokenProperty",
    punctuation: "editor-tokenPunctuation",
    regex: "editor-tokenVariable",
    selector: "editor-tokenSelector",
    string: "editor-tokenSelector",
    symbol: "editor-tokenProperty",
    tag: "editor-tokenProperty",
    url: "editor-tokenOperator",
    variable: "editor-tokenVariable",
  },
};

function onError(error: Error) {
  console.error(error);
}

// Custom plugin to handle keyboard commands
function KeyboardCommandPlugin({ onSubmit }: { onSubmit?: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && onSubmit) {
          event.preventDefault();
          onSubmit();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, onSubmit]);

  return null;
}

// Plugin to clear editor when value prop is empty
function ClearEditorPlugin({ value }: { value?: string }) {
  const [editor] = useLexicalComposerContext();
  const previousValue = useRef(value);

  useEffect(() => {
    if (value === "" && previousValue.current !== "") {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        root.append(paragraph);
        paragraph.select();
      });
    }
    previousValue.current = value;
  }, [editor, value]);

  return null;
}

// Plugin to persist editor state to localStorage
function LocalStoragePersistencePlugin({
  persistenceKey,
  clearOnSubmit,
}: {
  persistenceKey?: string;
  clearOnSubmit?: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const isFirstRender = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  // Load initial state from localStorage
  useEffect(() => {
    if (!persistenceKey || !isFirstRender.current) return;

    isFirstRender.current = false;
    const savedState = localStorage.getItem(persistenceKey);

    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState) as SerializedEditorState;
        const editorState = editor.parseEditorState(parsedState);
        editor.setEditorState(editorState);
      } catch (error) {
        console.error("Failed to restore editor state:", error);
      }
    }
  }, [editor, persistenceKey]);

  // Save state to localStorage on changes
  useEffect(() => {
    if (!persistenceKey) return;

    // Store the latest editor state in a ref for immediate access
    const latestStateRef = { current: null as SerializedEditorState | null };

    const unregister = editor.registerUpdateListener(({ editorState }) => {
      // Update the latest state ref immediately
      latestStateRef.current = editorState.toJSON();

      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Set new timer for debounced save
      debounceTimer.current = setTimeout(() => {
        if (latestStateRef.current) {
          localStorage.setItem(persistenceKey, JSON.stringify(latestStateRef.current));
        }
      }, 500); // 500ms debounce
    });

    // Save immediately before page unload
    const handleBeforeUnload = () => {
      // Cancel any pending debounced save
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      // Save the latest state immediately
      if (latestStateRef.current) {
        localStorage.setItem(persistenceKey, JSON.stringify(latestStateRef.current));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unregister();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [editor, persistenceKey]);

  // Clear localStorage when content is cleared (e.g., after submit)
  useEffect(() => {
    if (!persistenceKey || !clearOnSubmit) return;

    const unregister = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        const isEmpty =
          children.length === 0 ||
          (children.length === 1 && children[0].getTextContent().trim() === "");

        if (isEmpty) {
          localStorage.removeItem(persistenceKey);
        }
      });
    });

    return unregister;
  }, [editor, persistenceKey, clearOnSubmit]);

  return null;
}

interface LexicalEditorProps {
  placeholder?: string;
  onChange?: (text: string) => void;
  className?: string;
  contentEditableClassName?: string;
  padding?: React.CSSProperties;
  onSubmit?: () => void;
  value?: string;
  repoUrl?: string;
  branch?: string;
  persistenceKey?: string; // Key for localStorage persistence
  onEditorReady?: (editor: {
    getContent: () => {
      text: string;
      images: Array<{
        src: string;
        fileName?: string;
        altText: string;
      }>;
    };
    clear: () => void;
  }) => void;
}

export default function LexicalEditor({
  placeholder = "Start typing...",
  onChange,
  className,
  contentEditableClassName,
  padding,
  onSubmit,
  value,
  repoUrl,
  branch,
  persistenceKey,
  onEditorReady,
}: LexicalEditorProps) {
  const initialConfig = {
    namespace: "TaskEditor",
    theme,
    onError,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      LinkNode,
      AutoLinkNode,
      ImageNode,
    ],
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={clsx("editor-container", className)}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className={clsx(
                "editor-input",
                "outline-none",
                contentEditableClassName
              )}
              style={padding}
              aria-placeholder={placeholder}
              placeholder={
                <div
                  className="editor-placeholder pointer-events-none select-none text-neutral-900"
                  style={padding}
                >
                  {placeholder}
                </div>
              }
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin
          onChange={(editorState) => {
            editorState.read(() => {
              const root = $getRoot();
              const text = root.getTextContent();
              onChange?.(text);
            });
          }}
        />
        <HistoryPlugin />
        <AutoFocusPlugin />
        <ListPlugin />
        <LinkPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <KeyboardCommandPlugin onSubmit={onSubmit} />
        <ClearEditorPlugin value={value} />
        <LocalStoragePersistencePlugin
          persistenceKey={persistenceKey}
          clearOnSubmit={true}
        />
        <MentionPlugin repoUrl={repoUrl} branch={branch} />
        <ImagePlugin />
        <EditorStatePlugin onEditorReady={onEditorReady} />
      </div>
    </LexicalComposer>
  );
}
