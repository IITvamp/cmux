import { isElectron } from "@/lib/electron";
import React from "react";

type ElectronAwareWebViewProps = {
  src: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  // iframe-only attributes
  sandbox?: string;
  allow?: string;
  allowFullScreen?: boolean;
  // webview-only attributes
  allowPopups?: boolean;
};

export function ElectronWebViewOrIframe(props: ElectronAwareWebViewProps) {
  const {
    src,
    title,
    className,
    style,
    sandbox,
    allow,
    allowFullScreen,
    allowPopups,
  } = props;

  if (isElectron) {
    // In Electron, prefer the <webview> tag for better integration.
    // Note: BrowserWindow must be created with webviewTag: true.
    return (
      <webview
        src={src}
        className={className}
        style={style}
        // allowpopups is a boolean attribute for Electron <webview>
        allowpopups={allowPopups ?? true}
      />
    );
  }

  // On the web, render a standard iframe.
  return (
    <iframe
      src={src}
      title={title}
      className={className}
      style={style}
      sandbox={sandbox}
      allow={allow}
      allowFullScreen={allowFullScreen}
    />
  );
}
