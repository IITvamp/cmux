import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import type { CSSProperties, MouseEvent } from "react";

interface SidebarToggleButtonProps {
  isExpanded: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  isVisible?: boolean;
  disabled?: boolean;
  className?: string;
  iconClassName?: string;
}

export function SidebarToggleButton({
  isExpanded,
  onClick,
  isVisible = true,
  disabled = false,
  className,
  iconClassName,
}: SidebarToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "grid place-content-center rounded cursor-default transition-colors",
        "w-[20px] h-4 min-w-[20px]",
        disabled && "opacity-50",
        !isVisible && "invisible",
        className
      )}
      aria-disabled={disabled}
      disabled={disabled}
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      <ChevronRight
        className={clsx(
          "transition-transform w-3 h-3 text-neutral-500 dark:text-neutral-400",
          isExpanded && "rotate-90",
          iconClassName
        )}
      />
    </button>
  );
}
