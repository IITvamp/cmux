import { useEffect, useState } from "react";

export function CurrentTime() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="absolute top-4 right-4 text-right">
      <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        {formattedTime}
      </div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400">
        {formattedDate}
      </div>
    </div>
  );
}