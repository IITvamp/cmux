export const isElectron = () => {
  if (typeof window !== "undefined" && typeof window.process === "object" && (window.process as any).type === "renderer") {
    return true;
  }

  if (typeof navigator !== "undefined" && typeof navigator.userAgent === "string" && navigator.userAgent.indexOf("Electron") >= 0) {
    return true;
  }

  return false;
};