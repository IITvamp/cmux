import { useMemo } from "react";

interface BrowserSectionProps {
  vncUrl: string;
}

export function BrowserSection({ vncUrl }: BrowserSectionProps) {
  const iframeUrl = useMemo(() => {
    const url = new URL(vncUrl);
    url.searchParams.set("autoconnect", "true");
    url.searchParams.set("scaling", "local");
    return url.toString();
  }, [vncUrl]);

  return (
    <div className="border-t border-neutral-200 dark:border-neutral-700">
      <div className="px-3.5 py-2 bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Browser
        </h3>
      </div>
      <div className="h-96">
        <iframe
          src={iframeUrl}
          className="w-full h-full border-0"
          title="Browser"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}