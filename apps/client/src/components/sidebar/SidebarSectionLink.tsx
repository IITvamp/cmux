import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { type ReactNode } from "react";

import { type SidebarLinkRecord } from "./SidebarNavLink";

const BASE_CLASSES =
  "pointer-default cursor-default flex items-center rounded-sm pl-2 ml-2 pr-3 py-0.5 text-[12px] font-medium text-neutral-600 select-none hover:bg-neutral-200/45 dark:text-neutral-300 dark:hover:bg-neutral-800/45";
const ACTIVE_CLASSES =
  "bg-neutral-200/75 text-neutral-900 dark:bg-neutral-800/65 dark:text-neutral-100";

interface SidebarSectionLinkProps {
  to: string;
  params?: SidebarLinkRecord;
  search?: SidebarLinkRecord;
  exact?: boolean;
  children: ReactNode;
  className?: string;
}

export function SidebarSectionLink({
  to,
  params,
  search,
  exact = true,
  children,
  className,
}: SidebarSectionLinkProps) {
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
      {children}
    </Link>
  );
}
