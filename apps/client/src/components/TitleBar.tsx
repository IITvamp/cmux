import { Clock } from "./Clock";

export function TitleBar({ title }: { title: string }) {
  return (
    <div
      className="min-h-[24px] border-b border-neutral-200/70 dark:border-neutral-800/50 flex items-center justify-between relative select-none px-2"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Traffic light placeholder - will be handled by macOS */}
      <div
        className="absolute left-0 w-20 h-full"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      />

      {/* Title - centered */}
      <div className="flex-1 text-center">
        <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100 transform -translate-y-px">
          {title}
        </span>
      </div>

      {/* Clock - right side */}
      <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <Clock />
      </div>
    </div>
  );
}
