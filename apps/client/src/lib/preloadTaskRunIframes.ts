import { persistentIframeManager } from "./persistentIframeManager";
import { getTaskRunPersistKey } from "./persistent-webview-keys";

/**
 * Preload iframes for task runs
 * @param taskRunIds - Array of task run IDs to preload
 * @returns Promise that resolves when all iframes are loaded
 */
const TASK_RUN_IFRAME_PERMISSION_TOKENS = [
  "accelerometer",
  "ambient-light-sensor",
  "autoplay",
  "battery",
  "camera",
  "clipboard-read",
  "clipboard-write",
  "cross-origin-isolated",
  "display-capture",
  "document-domain",
  "encrypted-media",
  "fullscreen",
  "gamepad",
  "geolocation",
  "gyroscope",
  "hid",
  "identity-credentials-get",
  "idle-detection",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "picture-in-picture",
  "publickey-credentials-create",
  "publickey-credentials-get",
  "screen-wake-lock",
  "serial",
  "speaker-selection",
  "storage-access",
  "sync-xhr",
  "usb",
  "web-share",
  "window-management",
  "xr-spatial-tracking",
] as const;

export const TASK_RUN_IFRAME_ALLOW = TASK_RUN_IFRAME_PERMISSION_TOKENS.join("; ");

export const TASK_RUN_IFRAME_SANDBOX =
  "allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation";

export async function preloadTaskRunIframes(
  data: { url: string; taskRunId: string }[]
): Promise<void> {
  const entries = data.map(({ url, taskRunId }) => {
    const key = getTaskRunPersistKey(taskRunId);
    return {
      key,
      url,
      allow: TASK_RUN_IFRAME_ALLOW,
      sandbox: TASK_RUN_IFRAME_SANDBOX,
    };
  });

  await persistentIframeManager.preloadMultiple(entries);
}

/**
 * Preload a single task run iframe
 * @param taskRunId - Task run ID to preload
 * @returns Promise that resolves when the iframe is loaded
 */
export async function preloadTaskRunIframe(
  taskRunId: string,
  url: string
): Promise<void> {
  await persistentIframeManager.preloadIframe(getTaskRunPersistKey(taskRunId), url, {
    allow: TASK_RUN_IFRAME_ALLOW,
    sandbox: TASK_RUN_IFRAME_SANDBOX,
  });
}

/**
 * Remove a task run iframe from memory
 * @param taskRunId - Task run ID to remove
 */
export function removeTaskRunIframe(taskRunId: string): void {
  persistentIframeManager.removeIframe(getTaskRunPersistKey(taskRunId));
}

/**
 * Get all currently loaded task run iframe keys
 * @returns Array of task run IDs that have loaded iframes
 */
export function getLoadedTaskRunIframes(): string[] {
  return persistentIframeManager
    .getLoadedKeys()
    .filter((key) => key.startsWith("task-run:"))
    .map((key) => key.replace("task-run:", ""));
}
