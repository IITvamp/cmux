import * as React from "react";
import { cn } from "@/lib/utils";
import { memo, isValidElement, cloneElement } from "react";
import { Tooltip as BaseTooltip } from "@base-ui-components/react/tooltip";

// Local replicas of types to avoid deep type imports
type TooltipSide = "top" | "bottom" | "left" | "right" | "inline-end" | "inline-start";
type TooltipAlign = "start" | "center" | "end";
type PaddingLike = number | { top?: number; right?: number; bottom?: number; left?: number };
type BoundaryLike = "clipping-ancestors" | Element | Element[] | { width: number; height: number; x: number; y: number };

const TooltipProvider = memo(function TooltipProvider({
  delay = 0,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Provider>) {
  return (
    <BaseTooltip.Provider data-slot="tooltip-provider" delay={delay} {...props} />
  );
});

function Tooltip({ children, ...props }: React.ComponentProps<typeof BaseTooltip.Root>) {
  return (
    <TooltipProvider>
      <BaseTooltip.Root data-slot="tooltip" {...props}>
        {children}
      </BaseTooltip.Root>
    </TooltipProvider>
  );
}

interface TooltipTriggerProps
  extends Omit<React.ComponentProps<typeof BaseTooltip.Trigger>, "className"> {
  className?: string;
  asChild?: boolean;
  children?: React.ReactNode;
}

function TooltipTrigger({ asChild, children, className, ...props }: TooltipTriggerProps) {
  if (asChild && isValidElement(children)) {
    return (
      <BaseTooltip.Trigger
        data-slot="tooltip-trigger"
        className={className}
        // Replace element with the child, spreading trigger props on it
        render={(renderProps: React.HTMLAttributes<HTMLElement>) =>
          cloneElement(children as React.ReactElement<{ className?: string }>, {
            ...renderProps,
            className: cn(renderProps.className, (children as React.ReactElement<{ className?: string }>).props.className),
          })
        }
        {...props}
      />
    );
  }

  return (
    <BaseTooltip.Trigger data-slot="tooltip-trigger" className={className} {...props}>
      {children}
    </BaseTooltip.Trigger>
  );
}

interface TooltipContentProps
  extends Omit<React.ComponentProps<typeof BaseTooltip.Popup>, "className"> {
  className?: string;
  side?: TooltipSide;
  sideOffset?: number;
  align?: TooltipAlign;
  alignOffset?: number;
  collisionBoundary?: BoundaryLike;
  collisionPadding?: PaddingLike;
}

function TooltipContent({
  className,
  side,
  sideOffset = 0,
  align,
  alignOffset,
  collisionBoundary,
  collisionPadding,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner
        data-slot="tooltip-positioner"
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionBoundary={collisionBoundary}
        collisionPadding={collisionPadding}
      >
        <BaseTooltip.Popup
          data-slot="tooltip-content"
          className={cn(
            // Base styles and animations (origin uses Base UI's transform origin variable)
            "z-50 w-fit origin-[var(--transform-origin)] rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-lg shadow-neutral-200 outline outline-1 outline-neutral-200 transition-[transform,opacity] pointer-events-none select-none",
            // Enter/exit transitions controlled by data attributes from Base UI
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
            // Dark mode outline/shadow adjustments
            "dark:shadow-none dark:-outline-offset-1 dark:outline-neutral-700",
            className
          )}
          {...props}
        >
          {children}
          <BaseTooltip.Arrow className="pointer-events-none">
            <div
              className={cn(
                // Diamond arrow similar to previous Radix arrow
                "bg-primary rotate-45 size-2.5 rounded-[2px]",
                // Position tweaks per side
                "data-[side=top]:-mb-1 data-[side=bottom]:-mt-1 data-[side=left]:-mr-1 data-[side=right]:-ml-1",
                // Outline to match popup border in light/dark
                "outline outline-1 outline-neutral-200 dark:outline-neutral-700"
              )}
            />
          </BaseTooltip.Arrow>
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
