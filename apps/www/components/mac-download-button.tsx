"use client";

import { useEffect, useState } from "react";

interface MacDownloadButtonProps {
  arm64Url: string;
  x64Url: string;
  fallbackUrl: string;
  latestVersion: string | null;
}

type Architecture = "arm64" | "x64" | "unknown";

export default function MacDownloadButton({
  arm64Url,
  x64Url,
  fallbackUrl,
  latestVersion,
}: MacDownloadButtonProps) {
  const [architecture, setArchitecture] = useState<Architecture>("unknown");
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    const detectArchitecture = async () => {
      try {
        // Check if we're on macOS
        const isMac = /Mac/.test(navigator.userAgent);

        if (!isMac) {
          setArchitecture("unknown");
          setIsDetecting(false);
          return;
        }

        // Try to detect architecture using various methods
        // Method 1: Check for Apple Silicon using GPU info (most reliable)
        if ("gpu" in navigator) {
          const gpu = (navigator as any).gpu;
          if (gpu) {
            try {
              const adapter = await gpu.requestAdapter();
              if (adapter) {
                const info = await adapter.requestAdapterInfo();
                if (info && info.description) {
                  // Apple Silicon GPUs typically contain "Apple" in their description
                  if (info.description.toLowerCase().includes("apple")) {
                    setArchitecture("arm64");
                    setIsDetecting(false);
                    return;
                  }
                }
              }
            } catch (e) {
              // GPU API not available or failed
            }
          }
        }

        // Method 2: Check using platform detection
        const platform = navigator.platform?.toLowerCase() || "";
        const userAgent = navigator.userAgent?.toLowerCase() || "";

        // Check for ARM indicators
        if (platform.includes("arm") || userAgent.includes("arm")) {
          setArchitecture("arm64");
        }
        // Check for Intel indicators
        else if (platform.includes("intel") || platform.includes("x86") || platform.includes("mac")) {
          // Additional check: Apple Silicon Macs in Rosetta still report as Intel in some cases
          // We can use performance characteristics to make an educated guess
          const checkPerformance = () => {
            const start = performance.now();
            // Simple computation to measure performance characteristics
            let sum = 0;
            for (let i = 0; i < 1000000; i++) {
              sum += Math.sqrt(i);
            }
            const duration = performance.now() - start;

            // Apple Silicon tends to be significantly faster at this
            // This is a heuristic and may not be 100% accurate
            return duration < 10 ? "arm64" : "x64";
          };

          // For now, default to x64 for backwards compatibility if platform says mac
          setArchitecture("x64");
        } else {
          setArchitecture("unknown");
        }
      } catch (error) {
        console.error("Error detecting architecture:", error);
        setArchitecture("unknown");
      } finally {
        setIsDetecting(false);
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

  const getButtonText = () => {
    if (isDetecting) {
      return "Detecting...";
    }

    switch (architecture) {
      case "arm64":
        return "Download for Mac (Apple Silicon)";
      case "x64":
        return "Download for Mac (Intel)";
      default:
        return "Download for Mac";
    }
  };

  const getTitle = () => {
    if (!latestVersion) {
      return "Requires macOS";
    }

    switch (architecture) {
      case "arm64":
        return `Download cmux ${latestVersion} for macOS (Apple Silicon)`;
      case "x64":
        return `Download cmux ${latestVersion} for macOS (Intel)`;
      default:
        return `Download cmux ${latestVersion} for macOS`;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <a
        href={getDownloadUrl()}
        title={getTitle()}
        className="inline-flex h-12 items-center gap-2 text-base font-medium text-black bg-white hover:bg-neutral-50 border border-neutral-800 rounded-lg px-4 transition-all whitespace-nowrap"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 16 16"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M12.665 15.358c-.905.844-1.893.711-2.843.311-1.006-.409-1.93-.427-2.991 0-1.33.551-2.03.391-2.825-.31C-.498 10.886.166 4.078 5.28 3.83c1.246.062 2.114.657 2.843.71 1.09-.213 2.133-.826 3.296-.746 1.393.107 2.446.64 3.138 1.6-2.88 1.662-2.197 5.315.443 6.337-.526 1.333-1.21 2.657-2.345 3.635zM8.03 3.778C7.892 1.794 9.563.16 11.483 0c.268 2.293-2.16 4-3.452 3.777"
          ></path>
        </svg>
        {getButtonText()}
      </a>

      {/* Show both options if detection is uncertain or user wants to choose */}
      {!isDetecting && architecture === "unknown" && (
        <div className="flex flex-col gap-1 text-xs text-neutral-400">
          <span>Choose your Mac type:</span>
          <div className="flex gap-2">
            <a
              href={arm64Url}
              className="text-sky-400 hover:text-sky-300 underline"
            >
              Apple Silicon (M1/M2/M3)
            </a>
            <span>|</span>
            <a
              href={x64Url}
              className="text-sky-400 hover:text-sky-300 underline"
            >
              Intel
            </a>
          </div>
        </div>
      )}
    </div>
  );
}