"use client";

import { useEffect } from "react";
import CmuxLogo from "@/app/components/CmuxLogo";
import { JetBrains_Mono } from "next/font/google";

const jetbrains = JetBrains_Mono({ subsets: ["latin"], preload: true });

export function OpenCmuxClient({ href }: { href: string }) {
  useEffect(() => {
    try {
      window.location.href = href;
    } catch {
      // Ignore — rely on the visible fallback UI.
    }
  }, [href]);

  return (
    <div className={`min-h-dvh flex items-center justify-center p-6 bg-neutral-50 dark:bg-black ${jetbrains.className}`}>
      <div className="w-full max-w-md text-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-8 shadow-sm">
        <div className="mb-5 flex items-center justify-center">
          <CmuxLogo height={56} label="cmux" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Opening cmux…
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          If it doesn't open automatically, click the button below.
        </p>
        <div className="mt-5">
          <a
            href={href}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90"
          >
            Open cmux
          </a>
        </div>
      </div>
    </div>
  );
}
