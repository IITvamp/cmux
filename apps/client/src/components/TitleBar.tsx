import { CurrentTime } from "./CurrentTime";

export function TitleBar({ title }: { title: string }) {
  return (
    <div
      className="min-h-[24px] border-b border-neutral-200/70 dark:border-neutral-800/50 flex items-center justify-between relative select-none px-4"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Traffic light placeholder - will be handled by macOS */}
      <div
        className="absolute left-0 w-20 h-full"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      {/* Empty div for left side to maintain center alignment */}
      <div className="flex-1" />

      {/* Title */}
      <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100 transform -translate-y-px">
        {title}
      </div>

      {/* Right side with current time */}
      <div className="flex-1 flex justify-end">
        <CurrentTime />
      </div>
    </div>
  );
}
