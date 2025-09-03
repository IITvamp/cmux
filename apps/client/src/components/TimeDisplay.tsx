import { useEffect, useState } from "react";

export function TimeDisplay() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="flex items-center px-2 py-1">
      <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400 select-none">
        {formatTime(currentTime)}
      </span>
    </div>
  );
}