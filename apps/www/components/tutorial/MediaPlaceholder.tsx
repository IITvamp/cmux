import { Camera, Film } from "lucide-react";

type MediaPlaceholderProps = {
  type: "image" | "video";
  description: string;
  height?: string;
};

export function MediaPlaceholder({
  type,
  description,
  height = "h-96",
}: MediaPlaceholderProps) {
  return (
    <div
      className={`${height} rounded-lg border-2 border-dashed border-neutral-700 bg-neutral-900/50 flex flex-col items-center justify-center gap-3 px-6 text-center`}
    >
      {type === "image" ? (
        <Camera className="h-12 w-12 text-neutral-600" />
      ) : (
        <Film className="h-12 w-12 text-neutral-600" />
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-neutral-400">
          {type === "image" ? "Screenshot" : "Video"} Placeholder
        </p>
        <p className="text-xs text-neutral-500 max-w-sm">{description}</p>
      </div>
    </div>
  );
}
