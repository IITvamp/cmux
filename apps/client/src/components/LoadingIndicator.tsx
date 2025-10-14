interface LoadingIndicatorProps {
  message?: string;
}

export function LoadingIndicator({ message = "Loading..." }: LoadingIndicatorProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-1">
        <div
          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <div
          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <div
          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <span className="text-sm text-neutral-500">{message}</span>
    </div>
  );
}
