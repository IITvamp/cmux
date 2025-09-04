import type React from "react";

// Minimal typings for Electron's <webview> so TSX compiles in the renderer.
// Keep attributes we actually use to avoid depending on Electron types here.
declare global {
  type HTMLWebViewElement = HTMLElement;

  namespace JSX {
    interface WebviewHTMLAttributes<T> extends React.HTMLAttributes<T> {
      src?: string;
      allowpopups?: boolean;
      // Common styling props will come from React.HTMLAttributes via extension
    }

    interface IntrinsicElements {
      webview: WebviewHTMLAttributes<HTMLWebViewElement>;
    }
  }
}

export {};
