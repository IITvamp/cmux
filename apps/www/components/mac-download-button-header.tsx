"use client";

import { useEffect, useState } from "react";

interface MacDownloadButtonHeaderProps {
  arm64Url: string;
  x64Url: string;
  fallbackUrl: string;
}

type Architecture = "arm64" | "x64" | "unknown";

export default function MacDownloadButtonHeader({
  arm64Url,
  x64Url,
  fallbackUrl,
}: MacDownloadButtonHeaderProps) {
  const [architecture, setArchitecture] = useState<Architecture>("unknown");

  useEffect(() => {
    const detectArchitecture = () => {
      try {
        // Simple detection based on user agent and platform
        const platform = navigator.platform?.toLowerCase() || "";
        const userAgent = navigator.userAgent?.toLowerCase() || "";
        const isMac = /Mac/.test(navigator.userAgent);

        if (!isMac) {
          setArchitecture("unknown");
          return;
        }

        // Check for ARM indicators
        if (platform.includes("arm") || userAgent.includes("arm")) {
          setArchitecture("arm64");
        } else {
          // Default to x64 for backwards compatibility
          setArchitecture("x64");
        }
      } catch (error) {
        console.error("Error detecting architecture:", error);
        setArchitecture("unknown");
      }
    };

    detectArchitecture();
  }, []);

  const getDownloadUrl = () => {
    switch (architecture) {
      case "arm64":
        return arm64Url;
      case "x64":
        return x64Url;
      default:
        return fallbackUrl;
    }
  };

  return (
    <a
      href={getDownloadUrl()}
      className="inline-flex h-8 items-center bg-blue-500 px-3 text-base font-semibold text-white hover:bg-blue-400 transition"
    >
      Download
    </a>
  );
}