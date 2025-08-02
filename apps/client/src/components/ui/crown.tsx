import { cn } from "@/lib/utils";
import { Crown as CrownIcon } from "lucide-react";

interface CrownProps {
  className?: string;
  animate?: boolean;
}

export function Crown({ className, animate = true }: CrownProps) {
  return (
    <div className={cn("relative inline-flex", className)}>
      <CrownIcon 
        className={cn(
          "w-5 h-5 text-yellow-500 fill-yellow-500",
          animate && "animate-pulse"
        )} 
      />
      {animate && (
        <>
          {/* Sparkle effects */}
          <div className="absolute -top-1 -right-1 w-2 h-2">
            <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping" />
            <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: "200ms" }} />
          </div>
          <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5">
            <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: "400ms" }} />
          </div>
          <div className="absolute -top-1 -left-1 w-1.5 h-1.5">
            <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: "600ms" }} />
          </div>
        </>
      )}
    </div>
  );
}

export function CrownBadge({ 
  className,
  children,
  animate = true 
}: { 
  className?: string;
  children?: React.ReactNode;
  animate?: boolean;
}) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
      "bg-gradient-to-r from-yellow-100 to-yellow-50",
      "dark:from-yellow-900/30 dark:to-yellow-800/20",
      "border border-yellow-300 dark:border-yellow-700/50",
      className
    )}>
      <Crown animate={animate} className="w-4 h-4" />
      {children && (
        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
          {children}
        </span>
      )}
    </div>
  );
}