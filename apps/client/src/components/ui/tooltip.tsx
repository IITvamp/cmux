import { cn } from "@/lib/utils";
import { Tooltip as BaseTooltip } from "@base-ui-components/react/tooltip";
import * as React from "react";
import { cloneElement, isValidElement, memo } from "react";

// Local replicas of types to avoid deep type imports
type TooltipSide =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "inline-end"
  | "inline-start";
type TooltipAlign = "start" | "center" | "end";
type PaddingLike =
  | number
  | { top?: number; right?: number; bottom?: number; left?: number };
type BoundaryLike =
  | "clipping-ancestors"
  | Element
  | Element[]
  | { width: number; height: number; x: number; y: number };

const TooltipProvider = memo(function TooltipProvider({
  delay = 0,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Provider>) {
  return (
    <BaseTooltip.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  );
});

function Tooltip({
  children,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Root>) {
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

function TooltipTrigger({
  asChild,
  children,
  className,
  ...props
}: TooltipTriggerProps) {
  if (asChild && isValidElement(children)) {
    return (
      <BaseTooltip.Trigger
        data-slot="tooltip-trigger"
        className={className}
        // Replace element with the child, spreading trigger props on it
        render={(renderProps: React.HTMLAttributes<HTMLElement>) =>
          cloneElement(children as React.ReactElement<{ className?: string }>, {
            ...renderProps,
            className: cn(
              renderProps.className,
              (children as React.ReactElement<{ className?: string }>).props
                .className
            ),
          })
        }
        {...props}
      />
    );
  }

  return (
    <BaseTooltip.Trigger
      data-slot="tooltip-trigger"
      className={className}
      {...props}
    >
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
  sideOffset = 10,
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
            // Match demo styles exactly
            "flex origin-[var(--transform-origin)] flex-col rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs shadow-lg shadow-neutral-200 outline-1 outline-neutral-200 transition-[transform,scale,opacity]",
            // Enter/exit animations
            "data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[instant]:duration-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0",
            // Dark mode adjustments
            "dark:shadow-none dark:-outline-offset-1 dark:outline-neutral-300",
            // Keep high z-index for visibility
            "z-[99999] pointer-events-none select-none",
            className
          )}
          style={{ outline: "1px solid" }}
          {...props}
        >
          <BaseTooltip.Arrow className="data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180">
            <ArrowSvg />
          </BaseTooltip.Arrow>
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}

function ArrowSvg(props: React.ComponentProps<"svg">) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className="fill-primary"
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className="fill-neutral-200 dark:fill-none"
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className="dark:fill-neutral-300"
      />
    </svg>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
