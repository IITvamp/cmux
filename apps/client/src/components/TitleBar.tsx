export function TitleBar() {
  return (
    <div
      className="min-h-[20px] border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-center relative select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Traffic light placeholder - will be handled by macOS */}
      <div
        className="absolute left-0 w-20 h-full"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      />

      {/* Title */}
      <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100 leading-none">
        coderouter
      </div>
    </div>
  );
}
