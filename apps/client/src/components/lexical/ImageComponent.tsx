// No React import needed with the automatic JSX runtime

export default function ImageComponent({
  src,
  altText,
  fileName,
}: {
  src: string;
  altText: string;
  fileName?: string;
}) {
  return (
    <div className="relative inline-block my-2">
      <img
        src={src}
        alt={altText}
        className="max-w-full h-auto rounded-lg border border-neutral-200 dark:border-neutral-700"
        style={{ maxHeight: "300px" }}
      />
      {fileName && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 rounded-b-lg">
          {fileName}
        </div>
      )}
    </div>
  );
}
