import { Link, type LinkProps } from "@tanstack/react-router";
import clsx from "clsx";
import { type ComponentType } from "react";

const BASE_CLASSES =
  "pointer-default cursor-default group mx-1 flex items-center gap-2 rounded-sm pl-2 ml-2 pr-3 py-1 text-[13px] text-neutral-800 select-none hover:bg-neutral-200/45 dark:text-neutral-300 dark:hover:bg-neutral-800/45 data-[active=true]:hover:bg-neutral-200/75 dark:data-[active=true]:hover:bg-neutral-800/65";
const ACTIVE_CLASSES =
  "bg-neutral-200/75 text-neutral-900 dark:bg-neutral-800/65 dark:text-neutral-100";
const ICON_CLASSES =
  "size-[15px] text-neutral-500 group-hover:text-neutral-800 dark:group-hover:text-neutral-100 group-data-[active=true]:text-neutral-900 dark:group-data-[active=true]:text-neutral-100";

export type SidebarLinkRecord = Record<
  string,
  string | number | boolean | null | undefined
>;

interface SidebarNavLinkProps {
  to: LinkProps["to"];
  label: string;
  params?: LinkProps["params"];
  search?: LinkProps["search"];
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  exact?: boolean;
  className?: string;
}

export function SidebarNavLink({
  to,
  label,
  params,
  search,
  icon: Icon,
  exact = true,
  className,
}: SidebarNavLinkProps) {
  return (
    <Link
      to={to}
      params={params}
      search={search}
      activeOptions={{ exact }}
      className={clsx(BASE_CLASSES, className)}
      activeProps={{
        className: clsx(BASE_CLASSES, ACTIVE_CLASSES, className),
        "data-active": "true",
      }}
    >
      {Icon ? <Icon className={ICON_CLASSES} aria-hidden /> : null}
      <span>{label}</span>
    </Link>
  );
}
