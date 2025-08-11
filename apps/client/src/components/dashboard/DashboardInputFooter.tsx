import type { ReactNode } from "react";

interface DashboardInputFooterProps {
  children: ReactNode;
}

export function DashboardInputFooter({ children }: DashboardInputFooterProps) {
  return (
    <div className="flex items-end justify-between p-2 gap-1">{children}</div>
  );
}
