export const getIsElectron = () => {
  if (
    typeof window !== "undefined" &&
    typeof (window as unknown as { process?: unknown }).process === "object"
  ) {
    const wp = (window as unknown as { process?: { type?: string } }).process;
    if (wp && wp.type === "renderer") {
      return true;
    }
  }

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.indexOf("Electron") >= 0
  ) {
    return true;
  }

  return false;
};
export const isElectron = getIsElectron();
