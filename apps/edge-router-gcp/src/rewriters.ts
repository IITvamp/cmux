import {
  CONFIG_SCRIPT,
  SERVICE_WORKER_JS,
  SERVICE_WORKER_REGISTRATION_SCRIPT,
} from "./constants.js";

export { SERVICE_WORKER_JS };

// Strip headers that no longer match the rewritten body contents.
export const REWRITTEN_RESPONSE_IGNORED_HEADERS = [
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "content-md5",
  "content-digest",
  "etag",
] as const;

export function rewriteJavaScript(
  code: string,
  isExternalFile = false
): string {
  // Skip if it's our injected code
  if (code.includes("__CMUX_NO_REWRITE__")) {
    return code;
  }

  const prefix = isExternalFile
    ? `
// Injected by cmux proxy - ensure __cmuxLocation exists
(function() {
  if (typeof window === 'undefined') return;

  // If __cmuxLocation already exists, we're done
  if (window.__cmuxLocation && window.__cmuxLocation.href) return;

  // Create a temporary __cmuxLocation that uses real location
  // This will be replaced by our proxy once it loads
  if (!window.__cmuxLocation) {
    window.__cmuxLocation = window.location;
  }

  // Also ensure document.__cmuxLocation exists
  if (typeof document !== 'undefined' && !document.__cmuxLocation) {
    Object.defineProperty(document, '__cmuxLocation', {
      get: function() {
        return window.__cmuxLocation || window.location;
      },
      configurable: true
    });
  }
})();
`
    : "";

  let modified = code
    .replace(/\bwindow\.location\b/g, "window.__cmuxLocation")
    .replace(/\bdocument\.location\b/g, "document.__cmuxLocation");

  if (!isExternalFile) {
    modified = modified.replace(/\blocation\b/g, (match, offset) => {
      const before = modified.substring(Math.max(0, offset - 20), offset);
      const after = modified.substring(
        offset + match.length,
        Math.min(modified.length, offset + match.length + 10)
      );

      if (/\b(const|let|var)\s+$/.test(before)) return match;
      if (/[{,]\s*$/.test(before) && /\s*[:},]/.test(after)) return match;
      if (/\(\s*$/.test(before) || /^\s*[,)]/.test(after)) return match;
      if (/\.\s*$/.test(before)) return match;
      if (/^\s*:/.test(after)) return match;
      if (/__cmux$/.test(before)) return match;

      return "__cmuxLocation";
    });
  }

  modified = modified
    .replace(/window\.__cmux__cmuxLocation/g, "window.__cmuxLocation")
    .replace(/document\.__cmux__cmuxLocation/g, "document.__cmuxLocation")
    .replace(/__cmux__cmuxLocation/g, "__cmuxLocation");

  return prefix + modified;
}

const META_CSP_REGEX = /<meta[^>]+http-equiv=["']content-security-policy["'][^>]*>/gi;

export function rewriteHtmlDocument(
  html: string,
  options: { skipServiceWorker?: boolean; removeMetaCsp?: boolean } = {}
): string {
  const { skipServiceWorker = false, removeMetaCsp = false } = options;

  if (html.includes("data-cmux-injected=\"true\"")) {
    return removeMetaCsp ? html.replace(META_CSP_REGEX, "") : html;
  }

  let modified = html;

  if (removeMetaCsp) {
    modified = modified.replace(META_CSP_REGEX, "");
  }

  const injection = `${CONFIG_SCRIPT}${skipServiceWorker ? "" : SERVICE_WORKER_REGISTRATION_SCRIPT}`;

  const headMatch = /<head[^>]*>/i.exec(modified);
  if (headMatch) {
    const insertIndex = headMatch.index + headMatch[0].length;
    return (
      modified.slice(0, insertIndex) +
      injection +
      modified.slice(insertIndex)
    );
  }

  return injection + modified;
}
