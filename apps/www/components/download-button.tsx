"use client";

import { useEffect, useMemo, useState } from "react";

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

function getPlatform() {
  if (typeof navigator === "undefined") return "unknown" as const;
  const ua = navigator.userAgent || "";
  const platform = (navigator as { platform?: string }).platform || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMac = /Mac|Macintosh|Mac OS X/.test(platform) || /Mac OS X/.test(ua);
  const isWindows = /Win/.test(platform) || /Windows/.test(ua);
  if (isIOS) return "ios" as const;
  if (isAndroid) return "android" as const;
  if (isMac) return "macos" as const;
  if (isWindows) return "windows" as const;
  return "unknown" as const;
}

function DownloadButtonPlatform() {
  const isMounted = useMounted();
  const platform = useMemo(() => (isMounted ? getPlatform() : "unknown"), [
    isMounted,
  ]);

  if (!isMounted) return null;

  if (platform === "macos") {
    return (
      <button
        onClick={() => {
          // Direct users to releases page; downloading asset names may vary
          const link = document.createElement("a");
          link.href = "https://github.com/manaflow-ai/cmux/releases/latest";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
        className="flex items-center gap-2 text-sm font-medium text-black bg-white/90 hover:bg-white/95 rounded-lg px-3 py-2 transition-all whitespace-nowrap"
        suppressHydrationWarning
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 16 16"
          className="size-4"
        >
          <path
            fill="currentColor"
            d="M12.665 15.358c-.905.844-1.893.711-2.843.311-1.006-.409-1.93-.427-2.991 0-1.33.551-2.03.391-2.825-.31C-.498 10.886.166 4.078 5.28 3.83c1.246.062 2.114.657 2.843.71 1.09-.213 2.133-.826 3.296-.746 1.393.107 2.446.64 3.138 1.6-2.88 1.662-2.197 5.315.443 6.337-.526 1.333-1.21 2.657-2.345 3.635zM8.03 3.778C7.892 1.794 9.563.16 11.483 0c.268 2.293-2.16 4-3.452 3.777"
          ></path>
        </svg>
        Download for Mac
      </button>
    );
  } else if (platform === "windows") {
    return (
      <a
        href="https://forms.gle/QpJYQ6BY8k1e1G2U8"
        target="_blank"
        className="flex items-center gap-2 text-sm font-medium text-black bg-white/90 hover:bg-white/95 rounded-lg px-3 py-2 transition-all whitespace-nowrap"
        suppressHydrationWarning
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 16 16"
          className="size-4"
        >
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M0 0h7.584v7.584H0zm8.416 0h7.583v7.584H8.416zm-.832 8.416H0V16h7.584zm.832 0h7.583V16H8.416z"
            clipRule="evenodd"
          ></path>
        </svg>
        Join Windows waitlist
      </a>
    );
  } else if (platform === "ios") {
    return (
      <a
        href="https://forms.gle/QpJYQ6BY8k1e1G2U8"
        target="_blank"
        className="flex items-center gap-2 text-sm font-medium text-black bg-white/90 hover:bg-white/95 rounded-lg px-3 py-2 transition-all whitespace-nowrap"
        suppressHydrationWarning
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 16 16"
          className="size-4"
        >
          <path
            fill="currentColor"
            d="M12.665 15.358c-.905.844-1.893.711-2.843.311-1.006-.409-1.93-.427-2.991 0-1.33.551-2.03.391-2.825-.31C-.498 10.886.166 4.078 5.28 3.83c1.246.062 2.114.657 2.843.71 1.09-.213 2.133-.826 3.296-.746 1.393.107 2.446.64 3.138 1.6-2.88 1.662-2.197 5.315.443 6.337-.526 1.333-1.21 2.657-2.345 3.635zM8.03 3.778C7.892 1.794 9.563.16 11.483 0c.268 2.293-2.16 4-3.452 3.777"
          ></path>
        </svg>
        Join iOS waitlist
      </a>
    );
  } else if (platform === "android") {
    return (
      <a
        href="https://forms.gle/QpJYQ6BY8k1e1G2U8"
        target="_blank"
        className="flex items-center gap-2 text-sm font-medium text-black bg-white/90 hover:bg-white/95 rounded-lg px-3 py-2 transition-all whitespace-nowrap"
        suppressHydrationWarning
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 16 16"
          className="size-4"
        >
          <path
            fill="currentColor"
            d="M11.5 0h-7A1.5 1.5 0 003 1.5v13A1.5 1.5 0 004.5 16h7a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0011.5 0zM8 15a1 1 0 110-2 1 1 0 010 2zm4-3H4V2h8v10z"
          />
        </svg>
        Join Android waitlist
      </a>
    );
  } else {
    return (
      <a
        href="https://forms.gle/QpJYQ6BY8k1e1G2U8"
        target="_blank"
        className="flex items-center gap-2 text-sm font-medium text-black bg-white/90 hover:bg-white/95 rounded-lg px-3 py-2 transition-all whitespace-nowrap"
        suppressHydrationWarning
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 16 16"
          className="size-4"
        >
          <path
            fill="currentColor"
            d="M11.5 0h-7A1.5 1.5 0 003 1.5v13A1.5 1.5 0 004.5 16h7a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0011.5 0zM8 15a1 1 0 110-2 1 1 0 010 2zm4-3H4V2h8v10z"
          />
        </svg>
        Join waitlist
      </a>
    );
  }
}

export function DownloadButton() {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 h-[20px]" suppressHydrationWarning>
      <DownloadButtonPlatform />
    </div>
  );
}
