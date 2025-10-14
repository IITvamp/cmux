/**
 * Shared iframe permission policies used across the app.
 * Keep this list in sync with the latest Permissions Policy features.
 */
const PERMISSIVE_IFRAME_PERMISSION_TOKENS = [
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

export const PERMISSIVE_IFRAME_ALLOW = PERMISSIVE_IFRAME_PERMISSION_TOKENS.join("; ");

const PERMISSIVE_IFRAME_SANDBOX_TOKENS = [
  "allow-downloads",
  "allow-forms",
  "allow-modals",
  "allow-orientation-lock",
  "allow-pointer-lock",
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-presentation",
  "allow-same-origin",
  "allow-scripts",
  "allow-storage-access-by-user-activation",
  "allow-top-navigation",
  "allow-top-navigation-by-user-activation",
] as const;

export const PERMISSIVE_IFRAME_SANDBOX = PERMISSIVE_IFRAME_SANDBOX_TOKENS.join(" ");

export const PREVIEW_IFRAME_SANDBOX = [
  "allow-same-origin",
  "allow-scripts",
  "allow-popups",
  "allow-forms",
  "allow-modals",
  "allow-downloads",
].join(" ");
