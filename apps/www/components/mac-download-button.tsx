"use client";

import { useEffect, useState } from "react";

type MacArchitecture = "arm64" | "x64" | "unknown";

function detectMacArchitecture(): MacArchitecture {
  if (typeof navigator === "undefined") {
    return "unknown";
  }

  // Check if it's a Mac
  const isMac = navigator.platform.toLowerCase().includes("mac");
  if (!isMac) {
    return "unknown";
  }

  // Try to detect architecture from userAgent or platform
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();

  // Check for Apple Silicon indicators
  if (
    userAgent.includes("arm64") ||
    userAgent.includes("aarch64") ||
    platform.includes("arm")
  ) {
    return "arm64";
  }

  // Check for Intel indicators
  if (
    userAgent.includes("intel") ||
    platform.includes("intel") ||
    userAgent.includes("x86_64") ||
    platform.includes("x86")
  ) {
    return "x64";
  }

  // Default to arm64 for modern Macs (most likely Apple Silicon)
  // This is a reasonable default since most new Macs are Apple Silicon
  return "arm64";
}

type MacDownloadButtonProps = {
  macArm64DownloadUrl: string;
  macX64DownloadUrl: string;
  latestVersion: string | null;
  className?: string;
  children?: React.ReactNode;
};

export function MacDownloadButton({
  macArm64DownloadUrl,
  macX64DownloadUrl,
  latestVersion,
  className,
  children,
}: MacDownloadButtonProps) {
  const [architecture, setArchitecture] = useState<MacArchitecture>("unknown");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setArchitecture(detectMacArchitecture());
  }, []);

  // During SSR or before mount, use arm64 as default
  const downloadUrl =
    !mounted || architecture === "arm64" || architecture === "unknown"
      ? macArm64DownloadUrl
      : macX64DownloadUrl;

  const archLabel =
    mounted && architecture !== "unknown"
      ? architecture === "arm64"
        ? "Apple Silicon"
        : "Intel"
      : "arm64";

  const title = latestVersion
    ? `Download cmux for macOS (${archLabel})`
    : "Requires macOS";

  return (
    <a
      href={downloadUrl}
      title={title}
      className={className}
    >
      {children}
    </a>
  );
}
