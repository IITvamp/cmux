export async function isAppleSiliconMac(): Promise<boolean> {
  if (typeof navigator === "undefined") {
    return false;
  }

  const platform = (navigator.platform ?? "").toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();
  const isMac = platform.includes("mac") || userAgent.includes("macintosh");

  if (!isMac) {
    return false;
  }

  const navigatorWithUA = navigator as Navigator & {
    readonly userAgentData?: NavigatorUAData;
  };

  const uaData = navigatorWithUA.userAgentData;

  if (uaData?.getHighEntropyValues) {
    try {
      const { architecture } = await uaData.getHighEntropyValues([
        "architecture",
      ]);

      if (architecture) {
        return architecture.toLowerCase().includes("arm");
      }
    } catch {
      // Ignore failures and fall back to userAgent heuristics.
    }
  }

  return !userAgent.includes("intel");
}
