import { Menu } from "@base-ui-components/react/menu";
import clsx from "clsx";
import * as React from "react";

export type DropdownRootProps = React.ComponentPropsWithoutRef<
  typeof Menu.Root
>;

export const DropdownRoot: React.FC<DropdownRootProps> = ({
  children,
  ...props
}) => {
  return <Menu.Root {...props}>{children}</Menu.Root>;
};

export interface DropdownTriggerProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Trigger> {}

export const DropdownTrigger: React.FC<DropdownTriggerProps> = ({
  className,
  ...props
}) => {
  return (
    <Menu.Trigger {...props} className={clsx("outline-none", className)} />
  );
};

export interface DropdownPositionerProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Positioner> {}

export const DropdownPositioner: React.FC<DropdownPositionerProps> = ({
  className,
  ...props
}) => {
  return (
    <Menu.Positioner
      {...props}
      className={clsx("outline-none z-[9999]", className)}
    />
  );
};

export interface DropdownPopupProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Popup> {}

export const DropdownPopup: React.FC<DropdownPopupProps> = ({
  className,
  onClick,
  ...props
}) => {
  return (
    <Menu.Popup
      {...props}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={clsx(
        "origin-[var(--transform-origin)] rounded-md bg-white dark:bg-black py-1",
        "text-neutral-900 dark:text-neutral-100",
        "shadow-lg shadow-neutral-200 dark:shadow-neutral-950",
        "outline outline-neutral-200 dark:outline-neutral-800",
        "transition-[transform,scale,opacity]",
        "data-[ending-style]:scale-90 data-[ending-style]:opacity-0",
        "data-[starting-style]:scale-90 data-[starting-style]:opacity-0",
        className
      )}
    />
  );
};

export interface DropdownItemProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Item> {}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  className,
  ...props
}) => {
  return (
    <Menu.Item
      {...props}
      className={clsx(
        "flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-none select-none",
        "data-[highlighted]:relative data-[highlighted]:z-0",
        "data-[highlighted]:text-neutral-50 dark:data-[highlighted]:text-neutral-900",
        "data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0",
        "data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm",
        "data-[highlighted]:before:bg-neutral-900 dark:data-[highlighted]:before:bg-neutral-100",
        "data-[disabled]:text-neutral-400 dark:data-[disabled]:text-neutral-600 data-[disabled]:cursor-not-allowed",
        className
      )}
    />
  );
};

export interface DropdownArrowProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Arrow> {}

export const DropdownArrow: React.FC<DropdownArrowProps> = ({
  className,
  ...props
}) => {
  return (
    <Menu.Arrow
      {...props}
      className={clsx(
        "data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90",
        "data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180",
        className
      )}
    >
      <ArrowSvg />
    </Menu.Arrow>
  );
};

export const DropdownPortal = Menu.Portal;

function ArrowSvg(props: React.ComponentProps<"svg">) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className="fill-white dark:fill-black"
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className="fill-neutral-200 dark:fill-neutral-800"
      />
    </svg>
  );
}

export interface DropdownExports {
  Root: typeof DropdownRoot;
  Trigger: typeof DropdownTrigger;
  Positioner: typeof DropdownPositioner;
  Popup: typeof DropdownPopup;
  Item: typeof DropdownItem;
  Arrow: typeof DropdownArrow;
  Portal: typeof DropdownPortal;
  CheckboxItem: typeof DropdownCheckboxItem;
  CheckboxItemIndicator: typeof DropdownCheckboxItemIndicator;
}

// Checkbox variants
export interface DropdownCheckboxItemProps
  extends React.ComponentPropsWithoutRef<typeof Menu.CheckboxItem> {}

export const DropdownCheckboxItem: React.FC<DropdownCheckboxItemProps> = ({
  className,
  ...props
}) => {
  return (
    <Menu.CheckboxItem
      {...props}
      className={clsx(
        "grid cursor-default grid-cols-[0.75rem_1fr] items-center gap-2 py-2 pr-8 pl-2.5 text-sm leading-4 outline-none select-none",
        "data-[highlighted]:relative data-[highlighted]:z-0",
        "data-[highlighted]:text-neutral-50 dark:data-[highlighted]:text-neutral-900",
        "data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0",
        "data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm",
        "data-[highlighted]:before:bg-neutral-900 dark:data-[highlighted]:before:bg-neutral-100",
        "data-[disabled]:text-neutral-400 dark:data-[disabled]:text-neutral-600 data-[disabled]:cursor-not-allowed",
        className
      )}
    />
  );
};

export interface DropdownCheckboxItemIndicatorProps
  extends React.ComponentPropsWithoutRef<typeof Menu.CheckboxItemIndicator> {}

export const DropdownCheckboxItemIndicator: React.FC<
  DropdownCheckboxItemIndicatorProps
> = ({ className, ...props }) => {
  return (
    <Menu.CheckboxItemIndicator
      {...props}
      className={clsx(
        "col-start-1 flex items-center justify-center",
        className
      )}
    />
  );
};

// Named exports above include checkbox variants

export const Dropdown: DropdownExports = {
  Root: DropdownRoot,
  Trigger: DropdownTrigger,
  Positioner: DropdownPositioner,
  Popup: DropdownPopup,
  Item: DropdownItem,
  Arrow: DropdownArrow,
  Portal: DropdownPortal,
  CheckboxItem: DropdownCheckboxItem,
  CheckboxItemIndicator: DropdownCheckboxItemIndicator,
};
