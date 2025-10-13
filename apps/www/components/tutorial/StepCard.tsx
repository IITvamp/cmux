import type { ReactNode } from "react";

type StepCardProps = {
  number: number;
  title: string;
  children: ReactNode;
};

export function StepCard({ number, title, children }: StepCardProps) {
  return (
    <div className="relative pl-8 pb-8 border-l-2 border-neutral-800 last:border-l-0 last:pb-0">
      <div className="absolute -left-[17px] top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-neutral-800 bg-blue-500 text-sm font-bold text-white">
        {number}
      </div>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="text-neutral-300 space-y-4">{children}</div>
      </div>
    </div>
  );
}
