import express, { type Request, type Response } from "express";
import { parse } from "node-html-parser";
import { fetch } from "undici";

const app = express();
const PORT = process.env.PORT || 8080;

// Service worker content (same as Cloudflare version)
const SERVICE_WORKER_JS = `
function isLoopbackHostname(hostname) {
  if (!hostname) {
    return false;
  }

  if (hostname === 'localhost' || hostname === '0.0.0.0') {
    return true;
  }

  if (hostname === '::1' || hostname === '[::1]' || hostname === '::') {
    return true;
  }

  return /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if request is to localhost or a loopback IP with a port
  if (isLoopbackHostname(url.hostname) && url.port) {
    // Get the morph ID from the current page's subdomain
    const currentHost = self.location.hostname;
    const morphIdMatch = currentHost.match(/port-\\d+-(.*)\\.cmux\\.sh/);

    if (morphIdMatch) {
      const morphId = morphIdMatch[1];
      // Redirect to port-PORT-[morphid].cmux.sh
      const redirectUrl = \`https://port-\${url.port}-\${morphId}.cmux.sh\${url.pathname}\${url.search}\`;

      // Create new headers, but let the browser handle Host header
      const headers = new Headers(event.request.headers);
      // Remove headers that might cause issues with proxying
      headers.delete('Host'); // Browser will set this correctly
      headers.set('Host', 'cmux.sh');
      headers.delete('X-Forwarded-Host');
      headers.delete('X-Forwarded-For');
      headers.delete('X-Real-IP');

      // Create a completely new request to avoid any caching or DNS issues
      const newRequest = new Request(redirectUrl, {
        method: event.request.method,
        headers: headers,
        body: event.request.method !== 'GET' && event.request.method !== 'HEAD'
          ? event.request.body
          : undefined,
        mode: 'cors',
        credentials: event.request.credentials,
        redirect: 'follow',
      });

      event.respondWith(fetch(newRequest));
      return;
    }
  }

  // For all other requests, proceed normally
});`;

// Function to rewrite JavaScript code
function rewriteJavaScript(
  code: string,
  isExternalFile: boolean = false
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

  // Replace various patterns of location access
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

  // Fix any accidental double replacements
  modified = modified
    .replace(/window\.__cmux__cmuxLocation/g, "window.__cmuxLocation")
    .replace(/document\.__cmux__cmuxLocation/g, "document.__cmuxLocation")
    .replace(/__cmux__cmuxLocation/g, "__cmuxLocation");

  return prefix + modified;
}

const REWRITTEN_RESPONSE_IGNORED_HEADERS = [
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "content-md5",
  "content-digest",
  "etag",
];

function sanitizeRewrittenResponseHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const result = { ...headers };
  for (const header of REWRITTEN_RESPONSE_IGNORED_HEADERS) {
    delete result[header.toLowerCase()];
  }
  return result;
}

function stripCSPHeaders(headers: Record<string, string>): Record<string, string> {
  const result = { ...headers };
  delete result["content-security-policy"];
  delete result["content-security-policy-report-only"];
  return result;
}

function addPermissiveCORS(headers: Record<string, string>): Record<string, string> {
  return {
    ...headers,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "*",
    "access-control-allow-credentials": "true",
    "access-control-max-age": "86400",
  };
}

const HEAD_INJECTION_SCRIPT = (skipServiceWorker: boolean) => `<script data-cmux-injected="true">
// __CMUX_NO_REWRITE__ - This marker prevents this script from being rewritten
window.cmuxConfig = {
  taskRunId: "foo"
};

// Store the real location object (before any rewriting happens)
const __realLocation = window.location;

// Determine if a hostname should be treated as loopback/local
function isLoopbackHostname(hostname) {
  if (!hostname) {
    return false;
  }

  if (hostname === 'localhost' || hostname === '0.0.0.0') {
    return true;
  }

  if (hostname === '::1' || hostname === '[::1]' || hostname === '::') {
    return true;
  }

  return /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

// Function to replace loopback URLs with cmux.sh proxy
function replaceLocalhostUrl(url) {
  try {
    const urlObj = new URL(url, __realLocation.href);
    if (isLoopbackHostname(urlObj.hostname) && urlObj.port) {
      const currentHost = __realLocation.hostname;
      const morphIdMatch = currentHost.match(/port-\\d+-(.*)\\.cmux\\.sh/);

      if (morphIdMatch) {
        const morphId = morphIdMatch[1];
        urlObj.protocol = 'https:';
        urlObj.hostname = \`port-\${urlObj.port}-\${morphId}.cmux.sh\`;
        urlObj.port = '';
        return urlObj.toString();
      }
    }
    return url;
  } catch {
    return url;
  }
}

// Create our proxy location object that intercepts everything
const __cmuxLocation = new Proxy({}, {
  get(target, prop) {
    if (prop === Symbol.toStringTag) {
      return 'Location';
    }
    if (prop === Symbol.toPrimitive) {
      return function(hint) {
        return __realLocation.href;
      };
    }

    if (prop === 'assign') {
      return function(url) {
        const newUrl = replaceLocalhostUrl(url);
        return __realLocation.assign(newUrl);
      };
    }
    if (prop === 'replace') {
      return function(url) {
        const newUrl = replaceLocalhostUrl(url);
        return __realLocation.replace(newUrl);
      };
    }
    if (prop === 'reload') {
      return function() {
        return __realLocation.reload.apply(__realLocation, arguments);
      };
    }

    if (prop === 'toString') {
      return function() {
        return __realLocation.toString();
      };
    }
    if (prop === 'valueOf') {
      return function() {
        return __realLocation.valueOf();
      };
    }

    const locationProps = [
      'href', 'origin', 'protocol', 'host', 'hostname', 'port',
      'pathname', 'search', 'hash', 'username', 'password', 'searchParams'
    ];

    if (locationProps.includes(prop)) {
      return __realLocation[prop];
    }

    const value = __realLocation[prop];
    if (value !== undefined) {
      if (typeof value === 'function') {
        return value.bind(__realLocation);
      }
      return value;
    }

    return undefined;
  },
  set(target, prop, value) {
    if (prop === 'href') {
      const newUrl = replaceLocalhostUrl(value);
      __realLocation.href = newUrl;
      return true;
    }

    const settableProps = ['hash', 'search', 'pathname', 'port', 'hostname', 'host', 'protocol'];
    if (settableProps.includes(prop)) {
      __realLocation[prop] = value;
      return true;
    }

    return true;
  },
  has(target, prop) {
    return prop in __realLocation;
  },
  ownKeys(target) {
    return Object.keys(__realLocation);
  },
  getOwnPropertyDescriptor(target, prop) {
    return Object.getOwnPropertyDescriptor(__realLocation, prop);
  }
});

window.__cmuxLocation = __cmuxLocation;
window.__cmuxLocationProxy = __cmuxLocation;

try {
  Object.defineProperty(window, '__cmuxLocation', {
    value: __cmuxLocation,
    writable: false,
    configurable: true
  });
} catch (e) {}

try {
  if (window.parent && window.parent !== window) {
    window.parent.__cmuxLocation = __cmuxLocation;
  }
} catch (e) {}

try {
  if (window.top && window.top !== window) {
    window.top.__cmuxLocation = __cmuxLocation;
  }
} catch (e) {}

const originalGetElementById = document.getElementById;
if (originalGetElementById) {
  document.getElementById = function(id) {
    const element = originalGetElementById.call(this, id);
    if (element && element.tagName === 'IFRAME') {
      try {
        if (element.contentWindow) {
          element.contentWindow.__cmuxLocation = __cmuxLocation;
        }
      } catch (e) {}
    }
    return element;
  };
}

try {
  Object.defineProperty(document, 'location', {
    get() { return __cmuxLocation; },
    set(value) {
      const newUrl = replaceLocalhostUrl(value);
      __realLocation.href = newUrl;
    },
    configurable: true
  });
} catch (e) {}

document.__cmuxLocation = __cmuxLocation;

try {
  Object.defineProperty(window, 'location', {
    get() { return __cmuxLocation; },
    set(value) {
      if (typeof value === 'string') {
        const newUrl = replaceLocalhostUrl(value);
        __realLocation.href = newUrl;
      } else {
        __realLocation = value;
      }
    },
    configurable: true
  });
} catch (e) {}

const originalOpen = window.open;
window.open = function(url, ...args) {
  const newUrl = replaceLocalhostUrl(url);
  return originalOpen.call(this, newUrl, ...args);
};

document.addEventListener('click', function(e) {
  const target = e.target.closest('a');
  if (target && target.href) {
    const originalHref = target.getAttribute('href');
    const newUrl = replaceLocalhostUrl(target.href);
    if (newUrl !== target.href) {
      e.preventDefault();
      window.location.href = newUrl;
    }
  }
}, true);

document.addEventListener('submit', function(e) {
  const form = e.target;
  if (form && form.action) {
    const newAction = replaceLocalhostUrl(form.action);
    if (newAction !== form.action) {
      form.action = newAction;
    }
  }
}, true);

const originalPushState = history.pushState;
history.pushState = function(state, title, url) {
  if (url) {
    const newUrl = replaceLocalhostUrl(url);
    return originalPushState.call(this, state, title, newUrl);
  }
  return originalPushState.apply(this, arguments);
};

const originalReplaceState = history.replaceState;
history.replaceState = function(state, title, url) {
  if (url) {
    const newUrl = replaceLocalhostUrl(url);
    return originalReplaceState.call(this, state, title, newUrl);
  }
  return originalReplaceState.apply(this, arguments);
};

function startMutationObserver() {
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startMutationObserver);
    }
    return;
  }

  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'onclick') {
        const element = mutation.target;
        const onclickStr = element.getAttribute('onclick');
        if (onclickStr && onclickStr.includes('localhost')) {
          console.warn('Detected onclick with localhost:', onclickStr);
        }
      }
    });
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['onclick'],
    subtree: true,
    childList: true
  });
}

startMutationObserver();
</script>${
  !skipServiceWorker
    ? `
<script data-cmux-injected="true">
// __CMUX_NO_REWRITE__ - This marker prevents this script from being rewritten
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/proxy-sw.js', { scope: '/' }).catch(console.error);
}
</script>`
    : ""
}`;

function injectHeadScripts(html: string, skipServiceWorker: boolean): string {
  const root = parse(html);
  const head = root.querySelector("head");

  if (head) {
    const injection = HEAD_INJECTION_SCRIPT(skipServiceWorker);
    // Prepend to head
    head.insertAdjacentHTML("afterbegin", injection);
  }

  // Remove CSP meta tags if skipServiceWorker
  if (skipServiceWorker) {
    const cspMetas = root.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
    cspMetas.forEach((meta) => meta.remove());
  }

  return root.toString();
}

const LOOPBACK_V4_REGEX = /^127(?:\.\d{1,3}){3}$/;

function isLoopbackHostname(hostname: string | undefined): boolean {
  if (!hostname) return false;
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized === "0.0.0.0") return true;
  if (normalized === "::1" || normalized === "[::1]" || normalized === "::") return true;
  return LOOPBACK_V4_REGEX.test(normalized);
}

function rewriteLoopbackRedirect(
  location: string | null,
  buildProxyHost: (port: string) => string | null
): string | null {
  if (!location) return null;

  let parsed: URL;
  try {
    parsed = new URL(location);
  } catch {
    return null;
  }

  if (!isLoopbackHostname(parsed.hostname)) return null;

  const port = parsed.port;
  const proxyHost = buildProxyHost(port);
  if (!proxyHost) return null;

  parsed.protocol = "https:";
  parsed.hostname = proxyHost;
  parsed.port = "";

  return parsed.toString();
}

// Middleware to handle all requests
app.use(async (req: Request, res: Response) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const host = url.hostname.toLowerCase();

  // Root apex: reply with greeting
  if (host === "cmux.sh") {
    return res.status(200).type("text/plain").send("cmux!");
  }

  const suffix = ".cmux.sh";
  if (host.endsWith(suffix)) {
    const sub = host.slice(0, -suffix.length);

    // Serve the service worker file
    if (url.pathname === "/proxy-sw.js") {
      return res
        .status(200)
        .type("application/javascript")
        .header("cache-control", "no-cache")
        .send(SERVICE_WORKER_JS);
    }

    // Check if subdomain starts with "port-"
    if (sub.startsWith("port-")) {
      // Handle OPTIONS preflight for port-39378
      if (sub.startsWith("port-39378") && req.method === "OPTIONS") {
        const headers = addPermissiveCORS({});
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        return res.status(204).send();
      }

      // Prevent infinite loops
      if (req.headers["x-cmux-proxied"] === "true") {
        return res.status(508).send("Loop detected in proxy");
      }

      const parts = sub.split("-");
      if (parts.length >= 3) {
        const morphId = parts.slice(2).join("-");
        const morphSubdomain = `${parts[0]}-${parts[1]}-morphvm-${morphId}`;
        const targetUrl = `https://${morphSubdomain}.http.cloud.morph.so${url.pathname}${url.search}`;

        // WebSocket upgrades
        if (req.headers.upgrade?.toLowerCase() === "websocket") {
          return res.status(501).send("WebSocket proxying not implemented in this version");
        }

        try {
          const proxyHeaders: Record<string, string> = {};
          Object.entries(req.headers).forEach(([key, value]) => {
            if (value) proxyHeaders[key] = Array.isArray(value) ? value[0] : value;
          });
          proxyHeaders["x-cmux-proxied"] = "true";

          const proxyRes = await fetch(targetUrl, {
            method: req.method,
            headers: proxyHeaders,
            body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
            redirect: "manual",
          });

          // Rewrite location header for redirects
          const location = proxyRes.headers.get("location");
          const rewrittenLocation = rewriteLoopbackRedirect(location, (redirectPort) => {
            if (!redirectPort || !/^\d+$/.test(redirectPort)) return null;
            return `port-${redirectPort}-${morphId}.cmux.sh`;
          });

          const contentType = proxyRes.headers.get("content-type") || "";
          const skipServiceWorker = sub.startsWith("port-39378");

          // Convert headers to object
          const responseHeaders: Record<string, string> = {};
          proxyRes.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });

          // Apply header transformations
          let finalHeaders = stripCSPHeaders(responseHeaders);
          if (skipServiceWorker) {
            finalHeaders = addPermissiveCORS(finalHeaders);
          }
          if (rewrittenLocation) {
            finalHeaders["location"] = rewrittenLocation;
          }

          // Set headers
          Object.entries(finalHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
          });

          // Handle HTML responses
          if (contentType.includes("text/html")) {
            const text = await proxyRes.text();
            const rewritten = injectHeadScripts(text, skipServiceWorker);
            return res.status(proxyRes.status).send(rewritten);
          }

          // Handle JavaScript responses
          if (contentType.includes("javascript") || url.pathname.endsWith(".js")) {
            const text = await proxyRes.text();
            const rewritten = rewriteJavaScript(text, true);
            const sanitized = sanitizeRewrittenResponseHeaders(finalHeaders);
            Object.entries(sanitized).forEach(([key, value]) => {
              res.setHeader(key, value);
            });
            return res.status(proxyRes.status).send(rewritten);
          }

          // Pass through other responses
          const buffer = await proxyRes.arrayBuffer();
          return res.status(proxyRes.status).send(Buffer.from(buffer));
        } catch (error) {
          console.error("Proxy error:", error);
          return res.status(502).send("Bad Gateway");
        }
      }
    }

    // Handle cmux- prefixed subdomains
    if (sub.startsWith("cmux-")) {
      if (req.headers["x-cmux-proxied"] === "true") {
        return res.status(508).send("Loop detected in proxy");
      }

      const remainder = sub.slice("cmux-".length);
      const segments = remainder.split("-");
      if (segments.length < 2) {
        return res.status(400).send("Invalid cmux proxy subdomain");
      }

      const portSegment = segments[segments.length - 1];
      if (!/^\d+$/.test(portSegment)) {
        return res.status(400).send("Invalid port in cmux proxy subdomain");
      }

      const morphId = segments[0];
      if (!morphId) {
        return res.status(400).send("Missing morph id in cmux proxy subdomain");
      }

      const scopeSegments = segments.slice(1, -1);
      const hasExplicitScope = scopeSegments.length > 0;
      const scopeRaw = hasExplicitScope ? scopeSegments.join("-") : "base";
      const isBaseScope =
        !hasExplicitScope ||
        (scopeSegments.length === 1 && scopeSegments[0].toLowerCase() === "base");

      const targetUrl = `https://port-39379-morphvm-${morphId}.http.cloud.morph.so${url.pathname}${url.search}`;

      if (req.headers.upgrade?.toLowerCase() === "websocket") {
        return res.status(501).send("WebSocket proxying not implemented in this version");
      }

      try {
        const proxyHeaders: Record<string, string> = {};
        Object.entries(req.headers).forEach(([key, value]) => {
          if (value) proxyHeaders[key] = Array.isArray(value) ? value[0] : value;
        });
        proxyHeaders["x-cmux-proxied"] = "true";
        proxyHeaders["x-cmux-port-internal"] = portSegment;
        delete proxyHeaders["x-cmux-workspace-internal"];
        if (!isBaseScope) {
          proxyHeaders["x-cmux-workspace-internal"] = scopeRaw;
        }

        const proxyRes = await fetch(targetUrl, {
          method: req.method,
          headers: proxyHeaders,
          body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
          redirect: "manual",
        });

        const location = proxyRes.headers.get("location");
        const rewrittenLocation = rewriteLoopbackRedirect(location, (redirectPort) => {
          if (!redirectPort || !/^\d+$/.test(redirectPort)) return null;
          const scopeLabel = isBaseScope ? "base" : scopeRaw;
          return `cmux-${morphId}-${scopeLabel}-${redirectPort}.cmux.sh`;
        });

        const contentType = proxyRes.headers.get("content-type") || "";
        const skipServiceWorker = false;

        const responseHeaders: Record<string, string> = {};
        proxyRes.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        let finalHeaders = stripCSPHeaders(responseHeaders);
        if (skipServiceWorker) {
          finalHeaders = addPermissiveCORS(finalHeaders);
        }
        if (rewrittenLocation) {
          finalHeaders["location"] = rewrittenLocation;
        }

        Object.entries(finalHeaders).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        if (contentType.includes("text/html")) {
          const text = await proxyRes.text();
          const rewritten = injectHeadScripts(text, skipServiceWorker);
          return res.status(proxyRes.status).send(rewritten);
        }

        if (contentType.includes("javascript") || url.pathname.endsWith(".js")) {
          const text = await proxyRes.text();
          const rewritten = rewriteJavaScript(text, true);
          const sanitized = sanitizeRewrittenResponseHeaders(finalHeaders);
          Object.entries(sanitized).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
          return res.status(proxyRes.status).send(rewritten);
        }

        const buffer = await proxyRes.arrayBuffer();
        return res.status(proxyRes.status).send(Buffer.from(buffer));
      } catch (error) {
        console.error("Proxy error:", error);
        return res.status(502).send("Bad Gateway");
      }
    }

    // Original routing logic for non-Morph subdomains
    const parts = sub.split("-").filter(Boolean);
    if (parts.length < 3) {
      return res.status(400).send("Invalid cmux subdomain");
    }

    if (req.headers["x-cmux-proxied"] === "true") {
      return res.status(508).send("Loop detected in proxy");
    }

    const vmSlug = parts[parts.length - 1];
    const port = parts[parts.length - 2];
    const workspace = parts.slice(0, -2).join("-");

    if (!workspace) {
      return res.status(400).send("Missing workspace in subdomain");
    }
    if (!/^\d+$/.test(port)) {
      return res.status(400).send("Invalid port in subdomain");
    }

    const targetUrl = `https://${vmSlug}.vm.freestyle.sh${url.pathname}${url.search}`;

    if (req.headers.upgrade?.toLowerCase() === "websocket") {
      return res.status(501).send("WebSocket proxying not implemented in this version");
    }

    try {
      const proxyHeaders: Record<string, string> = {};
      Object.entries(req.headers).forEach(([key, value]) => {
        if (value) proxyHeaders[key] = Array.isArray(value) ? value[0] : value;
      });
      proxyHeaders["x-cmux-workspace-internal"] = workspace;
      proxyHeaders["x-cmux-port-internal"] = port;
      proxyHeaders["x-cmux-proxied"] = "true";

      const proxyRes = await fetch(targetUrl, {
        method: req.method,
        headers: proxyHeaders,
        body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
        redirect: "manual",
      });

      const location = proxyRes.headers.get("location");
      const rewrittenLocation = rewriteLoopbackRedirect(location, (redirectPort) => {
        if (!redirectPort || !/^\d+$/.test(redirectPort)) return null;
        return `${workspace}-${redirectPort}-${vmSlug}.cmux.sh`;
      });

      const contentType = proxyRes.headers.get("content-type") || "";
      const skipServiceWorker = sub.startsWith("port-39378");

      const responseHeaders: Record<string, string> = {};
      proxyRes.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let finalHeaders = stripCSPHeaders(responseHeaders);
      if (skipServiceWorker) {
        finalHeaders = addPermissiveCORS(finalHeaders);
      }
      if (rewrittenLocation) {
        finalHeaders["location"] = rewrittenLocation;
      }

      Object.entries(finalHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      if (contentType.includes("text/html")) {
        const text = await proxyRes.text();
        const rewritten = injectHeadScripts(text, skipServiceWorker);
        return res.status(proxyRes.status).send(rewritten);
      }

      if (contentType.includes("javascript") || url.pathname.endsWith(".js")) {
        const text = await proxyRes.text();
        const rewritten = rewriteJavaScript(text, true);
        const sanitized = sanitizeRewrittenResponseHeaders(finalHeaders);
        Object.entries(sanitized).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        return res.status(proxyRes.status).send(rewritten);
      }

      const buffer = await proxyRes.arrayBuffer();
      return res.status(proxyRes.status).send(Buffer.from(buffer));
    } catch (error) {
      console.error("Proxy error:", error);
      return res.status(502).send("Bad Gateway");
    }
  }

  // Not our domain — return 404
  return res.status(404).send("Not found");
});

app.listen(PORT, () => {
  console.log(`Edge router listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
