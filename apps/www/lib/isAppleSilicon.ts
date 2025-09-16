const ARM_HINTS = ["arm", "aarch", "apple silicon"];

const APPLE_SILICON_TOUCHPOINT_THRESHOLD = 2;

function hasArmArchitectureHint(userAgent: string): boolean {
  return ARM_HINTS.some((hint) => userAgent.includes(hint));
}

function getUserAgent(): string {
  if (typeof navigator === "undefined") {
    return "";
  }

  return navigator.userAgent.toLowerCase();
}

function isLikelyMac(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const platform = navigator.platform ?? "";
  return platform.toLowerCase().includes("mac");
}

function hasArmArchitectureFromUAData(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const uaData = (navigator as Navigator & {
    userAgentData?: {
      platform?: string;
      brands?: Array<{ brand?: string; version?: string }>;
      architecture?: string;
    };
  }).userAgentData;

  if (!uaData) {
    return false;
  }

  const platform = uaData.platform?.toLowerCase() ?? "";
  if (!platform.includes("mac")) {
    return false;
  }

  const architecture = uaData.architecture?.toLowerCase() ?? "";
  return hasArmArchitectureHint(architecture);
}

export async function isAppleSiliconMac(): Promise<boolean> {
  if (!isLikelyMac()) {
    return false;
  }

  if (hasArmArchitectureFromUAData()) {
    return true;
  }

  const userAgent = getUserAgent();
  if (userAgent && hasArmArchitectureHint(userAgent)) {
    return true;
  }

  if (
    typeof navigator !== "undefined" &&
    (navigator.maxTouchPoints ?? 0) >= APPLE_SILICON_TOUCHPOINT_THRESHOLD
  ) {
    return true;
  }

  return false;
}
