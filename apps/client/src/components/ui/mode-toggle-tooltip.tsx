import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Cloud, HardDrive } from "lucide-react";
import * as React from "react";

interface ModeToggleTooltipProps {
  isCloudMode: boolean;
  onToggle: () => void;
  className?: string;
}

export function ModeToggleTooltip({
  isCloudMode,
  onToggle,
  className,
}: ModeToggleTooltipProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleClick = () => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    onToggle();
    setShowTooltip(true);

    // Hide tooltip after 2 seconds
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 2000);
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    // Hide tooltip on mouse leave
    setShowTooltip(false);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "relative flex items-center h-5 w-9 rounded-full transition-colors",
          "border border-neutral-200 dark:border-neutral-600",
          isCloudMode
            ? "bg-blue-500 dark:bg-blue-600"
            : "bg-neutral-200 dark:bg-neutral-700",
          className
        )}
      >
        <span
          className={cn(
            "absolute flex items-center justify-center h-4 w-4 rounded-full bg-white dark:bg-neutral-200 shadow-sm transition-transform duration-200 ease-out",
            isCloudMode ? "translate-x-4" : "translate-x-0.5"
          )}
        >
          {isCloudMode ? (
            <Cloud className="w-2.5 h-2.5 text-blue-500" />
          ) : (
            <HardDrive className="w-2.5 h-2.5 text-neutral-600" />
          )}
        </span>
      </button>

      {/* Custom tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-1/2 -translate-x-1/2 z-50 mt-2"
          >
            {/* Arrow pointing up - matching shadcn style */}
            <div className="absolute left-[calc(50%_-4px)] translate-y-[calc(-50%_+1px)] size-2.5 rounded-[2px] rotate-45 bg-black" />
            <div
              className={cn(
                "relative px-3 py-1.5",
                "bg-black text-white text-xs rounded-md overflow-hidden w-20 whitespace-nowrap"
              )}
            >
              <div className="relative h-4 flex items-center w-full">
                <div className="relative w-full flex">
                  <motion.div
                    className="flex items-center justify-center absolute inset-0"
                    initial={false}
                    // animate={{ x: isCloudMode ? "-150%" : "0%" }}
                    animate={{ x: isCloudMode ? "0%" : "150%" }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <span className="text-center">Cloud Mode</span>
                  </motion.div>
                  <motion.div
                    className="flex items-center justify-center absolute inset-0"
                    initial={false}
                    // animate={{ x: isCloudMode ? "0%" : "150%" }}
                    animate={{ x: isCloudMode ? "-150%" : "0%" }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <span className="text-center">Local Mode</span>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
