"use client";

import { useEffect } from "react";

export function OpenCmuxClient({ href }: { href: string }) {
  useEffect(() => {
    try {
      // Attempt to open the Electron app via custom protocol.
      window.location.href = href;
    } catch (e) {
      // noop — rely on the clickable fallback below.
    }
  }, [href]);

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-white text-neutral-900 dark:bg-black dark:text-neutral-100">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-lg font-semibold">Opening cmux…</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          If it doesn't open automatically, click the button below.
        </p>
        <div>
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

