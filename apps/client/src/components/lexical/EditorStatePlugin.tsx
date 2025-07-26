import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $createParagraphNode } from "lexical";
import { useEffect } from "react";
import { $isImageNode } from "./ImageNode";

interface ExtractedContent {
  text: string;
  images: Array<{
    src: string;
    fileName?: string;
    altText: string;
  }>;
}

export function EditorStatePlugin({ onEditorReady }: { onEditorReady?: (api: any) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (onEditorReady) {
      const api = {
        getContent: (): ExtractedContent => {
          let content: ExtractedContent = {
            text: "",
            images: []
          };

          editor.getEditorState().read(() => {
            const root = $getRoot();
            let textParts: string[] = [];
            
            // Walk through all nodes to build text with image references
            const walkNode = (node: any) => {
              if ($isImageNode(node)) {
                const fileName = node.getFileName();
                const altText = node.getAltText();
                
                // Add image to images array
                content.images.push({
                  src: node.getSrc(),
                  fileName: fileName,
                  altText: altText
                });
                
                // Add image reference to text
                if (fileName) {
                  textParts.push(fileName);
                } else {
                  textParts.push(`[Image: ${altText}]`);
                }
              } else if (node.getType() === 'text') {
                textParts.push(node.getTextContent());
              } else if (node.getChildren) {
                const children = node.getChildren();
                children.forEach(walkNode);
                // Add newline after paragraphs
                if (node.getType() === 'paragraph' && textParts.length > 0) {
                  textParts.push('\n');
                }
              }
            };

            const children = root.getChildren();
            children.forEach(walkNode);

            // Build final text
            content.text = textParts.join('').trim();
          });

          return content;
        },
        clear: () => {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
            const paragraph = $createParagraphNode();
            root.append(paragraph);
            paragraph.select();
          });
        }
      };

      onEditorReady(api);
    }
  }, [editor, onEditorReady]);

  return null;
}