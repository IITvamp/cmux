import clsx from "clsx";
import type { MouseEvent, ReactNode } from "react";
import { SidebarToggleButton } from "../SidebarToggleButton";

interface SidebarListItemProps {
  title: ReactNode;
  titleClassName?: string;
  secondary?: ReactNode;
  secondaryClassName?: string;
  meta?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  paddingLeft?: number;
  className?: string;
  containerClassName?: string;
  toggle?: {
    expanded: boolean;
    onToggle: (
      event?: MouseEvent<HTMLButtonElement | HTMLAnchorElement>
    ) => void;
    visible?: boolean;
    className?: string;
    iconClassName?: string;
  };
}

export function SidebarListItem({
  title,
  titleClassName,
  secondary,
  secondaryClassName,
  meta,
  leading,
  trailing,
  paddingLeft = 8,
  className,
  containerClassName,
  toggle,
}: SidebarListItemProps) {
  const toggleVisible = toggle?.visible ?? Boolean(toggle);
  const effectivePaddingLeft = Math.max(
    0,
    toggleVisible ? paddingLeft - 4 : paddingLeft
  );

  return (
    <div className={clsx("relative group", containerClassName)}>
      <div
        className={clsx(
          "flex items-center rounded-md pr-2 py-0.5 text-xs",
          "hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-default",
          "group-[.active]:bg-neutral-100 dark:group-[.active]:bg-neutral-800",
          className
        )}
        style={{ paddingLeft: `${effectivePaddingLeft}px` }}
      >
        {toggle ? (
          <div className="pr-1 -ml-0.5">
            <SidebarToggleButton
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                toggle.onToggle(event);
              }}
              isExpanded={toggle.expanded}
              isVisible={toggleVisible}
              className={clsx("size-4", toggle.className)}
              iconClassName={toggle.iconClassName}
            />
          </div>
        ) : null}

        {leading ? <div className="mr-2 flex-shrink-0">{leading}</div> : null}

        <div className="flex-1 min-w-0 gap-px">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={clsx(
                "truncate text-neutral-900 dark:text-neutral-100",
                titleClassName
              )}
            >
              {title}
            </span>
            {meta ? (
              <span className="ml-auto flex-shrink-0">{meta}</span>
            ) : null}
          </div>
          {secondary ? (
            <div
              className={clsx(
                "truncate text-[10px] text-neutral-600 dark:text-neutral-400",
                secondaryClassName
              )}
            >
              {secondary}
            </div>
          ) : null}
        </div>
      </div>

      {trailing ? (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

export default SidebarListItem;
