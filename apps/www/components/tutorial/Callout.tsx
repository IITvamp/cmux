import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb,
} from "lucide-react";
import type { ReactNode } from "react";

type CalloutType = "info" | "warning" | "success" | "danger" | "tip";

type CalloutProps = {
  type: CalloutType;
  title?: string;
  children: ReactNode;
};

const calloutConfig: Record<
  CalloutType,
  {
    icon: typeof Info;
    bgColor: string;
    borderColor: string;
    iconColor: string;
    titleColor: string;
  }
> = {
  info: {
    icon: Info,
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    iconColor: "text-blue-400",
    titleColor: "text-blue-300",
  },
  warning: {
    icon: AlertTriangle,
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    iconColor: "text-yellow-400",
    titleColor: "text-yellow-300",
  },
  success: {
    icon: CheckCircle,
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    iconColor: "text-green-400",
    titleColor: "text-green-300",
  },
  danger: {
    icon: AlertCircle,
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    iconColor: "text-red-400",
    titleColor: "text-red-300",
  },
  tip: {
    icon: Lightbulb,
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    iconColor: "text-purple-400",
    titleColor: "text-purple-300",
  },
};

export function Callout({ type, title, children }: CalloutProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-lg border ${config.borderColor} ${config.bgColor} px-4 py-3`}
    >
      <div className="flex gap-3">
        <Icon className={`h-5 w-5 flex-shrink-0 ${config.iconColor} mt-0.5`} />
        <div className="flex-1 space-y-2">
          {title && (
            <div className={`font-semibold text-sm ${config.titleColor}`}>
              {title}
            </div>
          )}
          <div className="text-sm text-neutral-300 [&>p]:leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
