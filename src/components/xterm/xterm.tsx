import type { ComponentPropsWithoutRef } from "react";
import { useXTerm, type UseXTermProps } from "./use-xterm";

export interface XTermProps
  extends Omit<ComponentPropsWithoutRef<"div">, "onResize" | "onScroll">,
    UseXTermProps {}

export function XTerm({
  className = "",
  options,
  addons,
  listeners,
  ...props
}: XTermProps) {
  const { ref } = useXTerm({
    options,
    addons,
    listeners,
  });

  return <div className={className} ref={ref} {...props} />;
}
