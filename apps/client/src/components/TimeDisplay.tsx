import { useEffect, useState } from "react";

export function TimeDisplay() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
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
    <div className="flex items-center px-2">
      <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400 select-none">
        {formatTime(time)}
      </span>
    </div>
  );
}