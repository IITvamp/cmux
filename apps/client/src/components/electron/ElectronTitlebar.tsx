import React from "react";

export function ElectronTitlebar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-7 border-b border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-50/60 dark:bg-neutral-900/60 backdrop-blur-md"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      aria-hidden
    />
  );
}
