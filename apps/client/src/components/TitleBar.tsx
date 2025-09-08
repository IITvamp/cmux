import { useEffect, useState } from "react";

export function TitleBar({ title }: { title: string }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit' 
  });

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

      {/* Title */}
      <div className="flex-1 text-center">
        <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100 transform -translate-y-px">
          {title}
        </div>
      </div>

      {/* Current Time */}
      <div className="text-xs text-neutral-600 dark:text-neutral-400">
        {timeString}
      </div>
    </div>
  );
}
