"use client";

import posthog from "posthog-js";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { android, ios, macos, windows } from "platform-detect";
import { useEffect, useState } from "react";

import type { Release } from "@/lib/getLatestRelease";
import { isAppleSiliconMac as getIsAppleSiliconMac } from "@/lib/isAppleSilicon";

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

const downloadButtonFadeInDelay = 0.3;
const downloadButtonFadeInDuration = 1;

function DownloadButtonPlatform({ release }: { readonly release: Release | null }) {
  const isMounted = useMounted();

  const downloadMutation = useMutation({
    mutationFn: async () => {
      if (!release) {
        return;
      }

      const isAppleSilicon = await getIsAppleSiliconMac();
      const platform = isAppleSilicon ? "darwin-arm64" : "darwin-x64";
      const platformRelease = release.platforms[platform];

      if (!platformRelease) {
        console.error("No release available for platform:", platform);
        return;
      }

      const link = document.createElement("a");
      link.href = platformRelease.url;
      link.download = platformRelease.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  });

  if (!isMounted) {
    return null;
  }

  if (macos) {
    if (!release) {
      return (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: downloadButtonFadeInDelay,
            duration: downloadButtonFadeInDuration,
          }}
          exit={{ opacity: 0 }}
          disabled
          className="flex items-center gap-2 text-sm font-medium text-black bg-white/70 cursor-not-allowed rounded-lg px-3 py-2 transition-all whitespace-nowrap"
          suppressHydrationWarning
        >
          Loading download…
        </motion.button>
      );
    }

    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          delay: downloadButtonFadeInDelay,
          duration: downloadButtonFadeInDuration,
        }}
        exit={{ opacity: 0 }}
        onClick={() => {
          try {
            posthog.capture("download_button_clicked", {
              platform: "mac",
              type: "download",
            });
          } catch {
            // Ignore PostHog capture failures.
          }

          downloadMutation.mutate();
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
      </motion.button>
    );
  }

  const waitlistHref = "https://forms.gle/QpJYQ6BY8k1e1G2U8";

  if (windows) {
    return (
      <motion.a
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          delay: downloadButtonFadeInDelay,
          duration: downloadButtonFadeInDuration,
        }}
        exit={{ opacity: 0 }}
        href={waitlistHref}
        target="_blank"
        rel="noreferrer"
        onClick={() => {
          try {
            posthog.capture("download_button_clicked", {
              platform: "windows",
              type: "waitlist",
            });
          } catch {
            // Ignore PostHog capture failures.
          }
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
            fillRule="evenodd"
            d="M0 0h7.584v7.584H0zm8.416 0h7.583v7.584H8.416zm-.832 8.416H0V16h7.584zm.832 0h7.583V16H8.416z"
            clipRule="evenodd"
          ></path>
        </svg>
        Join Windows waitlist
      </motion.a>
    );
  }

  if (ios) {
    return (
      <motion.a
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          delay: downloadButtonFadeInDelay,
          duration: downloadButtonFadeInDuration,
        }}
        exit={{ opacity: 0 }}
        href={waitlistHref}
        target="_blank"
        rel="noreferrer"
        onClick={() => {
          try {
            posthog.capture("download_button_clicked", {
              platform: "ios",
              type: "waitlist",
            });
          } catch {
            // Ignore PostHog capture failures.
          }
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
        Join iOS waitlist
      </motion.a>
    );
  }

  if (android) {
    return (
      <motion.a
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          delay: downloadButtonFadeInDelay,
          duration: downloadButtonFadeInDuration,
        }}
        exit={{ opacity: 0 }}
        href={waitlistHref}
        target="_blank"
        rel="noreferrer"
        onClick={() => {
          try {
            posthog.capture("download_button_clicked", {
              platform: "android",
              type: "waitlist",
            });
          } catch {
            // Ignore PostHog capture failures.
          }
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
            d="M11.5 0h-7A1.5 1.5 0 003 1.5v13A1.5 1.5 0 004.5 16h7a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0011.5 0zM8 15a1 1 0 110-2 1 1 0 010 2zm4-3H4V2h8v10z"
          />
        </svg>
        Join Android waitlist
      </motion.a>
    );
  }

  return (
    <motion.a
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        delay: downloadButtonFadeInDelay,
        duration: downloadButtonFadeInDuration,
      }}
      exit={{ opacity: 0 }}
      href={waitlistHref}
      target="_blank"
      rel="noreferrer"
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
    </motion.a>
  );
}

export function DownloadButton({
  release,
}: {
  readonly release: Release | null;
}): JSX.Element {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className="flex items-center justify-center gap-2 sm:gap-4 h-[20px]"
        suppressHydrationWarning
      >
        <AnimatePresence>
          <DownloadButtonPlatform release={release} />
        </AnimatePresence>
      </div>
    </QueryClientProvider>
  );
}
