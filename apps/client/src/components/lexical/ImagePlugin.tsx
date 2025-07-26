import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $insertNodes } from "lexical";
import { useEffect, useRef, useState } from "react";
import { $createImageNode, ImageNode } from "./ImageNode";

export function ImagePlugin() {
  const [editor] = useLexicalComposerContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error("ImagePlugin: ImageNode not registered on editor");
    }

    // Handle paste events for images
    const handlePaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/")
      );

      if (imageFiles.length === 0) return;

      event.preventDefault();

      // Read files first, then update editor
      Promise.all(
        imageFiles.map((file) => {
          return new Promise<{ src: string; fileName: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = e.target?.result as string;
              resolve({ src: base64, fileName: file.name });
            };
            reader.readAsDataURL(file);
          });
        })
      ).then((images) => {
        editor.update(() => {
          images.forEach((image) => {
            const imageNode = $createImageNode({
              src: image.src,
              altText: image.fileName,
              fileName: image.fileName,
            });
            $insertNodes([imageNode]);
          });
        });
      });
    };

    // Handle drop events for images
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      
      dragCounter.current = 0;
      setIsDragging(false);

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/")
      );

      if (imageFiles.length === 0) return;

      // Read files first, then update editor
      Promise.all(
        imageFiles.map((file) => {
          return new Promise<{ src: string; fileName: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = e.target?.result as string;
              resolve({ src: base64, fileName: file.name });
            };
            reader.readAsDataURL(file);
          });
        })
      ).then((images) => {
        editor.update(() => {
          images.forEach((image) => {
            const imageNode = $createImageNode({
              src: image.src,
              altText: image.fileName,
              fileName: image.fileName,
            });
            $insertNodes([imageNode]);
          });
        });
      });
    };

    // Handle dragover to allow drop
    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };

    // Handle dragenter to provide visual feedback
    const handleDragEnter = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounter.current++;
      
      // Always set dragging to true when files are being dragged
      // We'll filter for images on drop
      setIsDragging(true);
    };

    // Handle dragleave to remove visual feedback
    const handleDragLeave = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounter.current--;
      
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };

    const rootElement = editor.getRootElement();
    if (rootElement) {
      rootElement.addEventListener("paste", handlePaste);
      rootElement.addEventListener("drop", handleDrop);
      rootElement.addEventListener("dragover", handleDragOver);
      rootElement.addEventListener("dragenter", handleDragEnter);
      rootElement.addEventListener("dragleave", handleDragLeave);
      
      // Apply visual feedback
      if (isDragging) {
        rootElement.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        rootElement.style.outline = '2px dashed rgb(59, 130, 246)';
        rootElement.style.outlineOffset = '-2px';
      } else {
        rootElement.style.backgroundColor = '';
        rootElement.style.outline = '';
        rootElement.style.outlineOffset = '';
      }
    }

    return () => {
      if (rootElement) {
        rootElement.removeEventListener("paste", handlePaste);
        rootElement.removeEventListener("drop", handleDrop);
        rootElement.removeEventListener("dragover", handleDragOver);
        rootElement.removeEventListener("dragenter", handleDragEnter);
        rootElement.removeEventListener("dragleave", handleDragLeave);
        // Clean up styles
        rootElement.style.backgroundColor = '';
        rootElement.style.outline = '';
        rootElement.style.outlineOffset = '';
      }
    };
  }, [editor, isDragging]);

  // Function to trigger file selection
  const handleFileSelect = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    // Read files first, then update editor
    Promise.all(
      imageFiles.map((file) => {
        return new Promise<{ src: string; fileName: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            resolve({ src: base64, fileName: file.name });
          };
          reader.readAsDataURL(file);
        });
      })
    ).then((images) => {
      editor.update(() => {
        images.forEach((image) => {
          const imageNode = $createImageNode({
            src: image.src,
            altText: image.fileName,
            fileName: image.fileName,
          });
          $insertNodes([imageNode]);
        });
      });
    });

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  // Expose the file select handler globally
  useEffect(() => {
    const handleGlobalFileSelect = () => {
      handleFileSelect();
    };
    
    (window as any).__lexicalImageFileSelect = handleGlobalFileSelect;
    
    return () => {
      delete (window as any).__lexicalImageFileSelect;
    };
  }, []);

  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      onChange={handleFileChange}
      style={{ display: "none" }}
    />
  );
}