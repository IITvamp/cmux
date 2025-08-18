import React, { useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { CommentsFloatingWidget } from './CommentsFloatingWidget';
import { styles } from '../dist/styles';

export interface PreviewCommentsWidgetProps {
  apiUrl?: string;
  userId?: string;
  userName?: string;
}

export function PreviewCommentsWidget({
  apiUrl = 'http://localhost:9779',
  userId = 'anonymous',
  userName = 'Anonymous User'
}: PreviewCommentsWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const reactRootRef = useRef<Root | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create shadow root
    if (!shadowRootRef.current) {
      shadowRootRef.current = containerRef.current.attachShadow({ mode: 'open' });
      
      // Add styles to shadow DOM
      const styleElement = document.createElement('style');
      styleElement.textContent = styles;
      shadowRootRef.current.appendChild(styleElement);
      
      // Create container for React
      const rootDiv = document.createElement('div');
      rootDiv.id = 'cmux-preview-comments-root';
      shadowRootRef.current.appendChild(rootDiv);
      
      // Create React root in shadow DOM
      reactRootRef.current = createRoot(rootDiv);
    }

    // Render the widget
    if (reactRootRef.current) {
      reactRootRef.current.render(
        <CommentsFloatingWidget
          apiUrl={apiUrl}
          userId={userId}
          userName={userName}
        />
      );
    }

    return () => {
      if (reactRootRef.current) {
        reactRootRef.current.unmount();
        reactRootRef.current = null;
      }
      shadowRootRef.current = null;
    };
  }, [apiUrl, userId, userName]);

  return <div ref={containerRef} style={{ position: 'fixed', zIndex: 9999 }} />;
}