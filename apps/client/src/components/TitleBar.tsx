export function TitleBar({
  title,
  rightContent,
}: {
  title: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <div
      className="min-h-[24px] border-b border-neutral-200/70 dark:border-neutral-800/50 flex items-center justify-between relative select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Traffic light placeholder - will be handled by macOS */}
      <div
        className="absolute left-0 w-20 h-full"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      />

      {/* Title */}
      <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100 transform -translate-y-px ml-20">
        {title}
      </div>

      {/* Right content */}
      {rightContent && (
        <div
          className="flex items-center pr-4"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {rightContent}
        </div>
      )}
    </div>
  );
}
