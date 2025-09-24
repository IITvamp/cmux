// Service worker content
const SERVICE_WORKER_JS = `console.log('Service worker loaded');

self.addEventListener('install', (event) => {
  console.log('Service worker installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activating');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if request is to localhost with a port
  if (url.hostname === 'localhost' && url.port) {
    // Get the morph ID from the current page's subdomain
    const currentHost = self.location.hostname;
    const morphIdMatch = currentHost.match(/port-\\d+-(.*)\\.cmux\\.sh/);

    if (morphIdMatch) {
      const morphId = morphIdMatch[1];
      // Redirect to port-PORT-[morphid].cmux.sh
      const redirectUrl = \`https://port-\${url.port}-\${morphId}.cmux.sh\${url.pathname}\${url.search}\`;

      console.log('Service worker redirecting:', event.request.url, '->', redirectUrl);

      // Create new request with same method, headers, and body
      event.respondWith(
        fetch(redirectUrl, {
          method: event.request.method,
          headers: event.request.headers,
          body: event.request.method !== 'GET' && event.request.method !== 'HEAD'
            ? event.request.body
            : undefined,
          mode: 'cors',
          credentials: event.request.credentials,
        })
      );
      return;
    }
  }

  // For all other requests, proceed normally
  console.log('Service worker fetch:', event.request.url);
});`;

// Function to rewrite JavaScript code
function rewriteJavaScript(code: string, isExternalFile: boolean = false): string {
  // Skip if it's our injected code
  if (code.includes('__CMUX_NO_REWRITE__')) {
    return code;
  }

  // For external files, we need to ensure __cmuxLocation exists first
  // since they might load before our injected script
  const prefix = isExternalFile ? `
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
` : '';

  // Replace various patterns of location access - keep it simple
  let modified = code
    // Replace window.location
    .replace(/\bwindow\.location\b/g, 'window.__cmuxLocation')
    // Replace document.location
    .replace(/\bdocument\.location\b/g, 'document.__cmuxLocation')
    // Replace bare location (but not if preceded by . or word character)
    .replace(/(?<![.\w])location\b/g, '__cmuxLocation')
    // Fix any double replacements
    .replace(/window\.__cmux__cmuxLocation/g, 'window.__cmuxLocation')
    .replace(/document\.__cmux__cmuxLocation/g, 'document.__cmuxLocation')
    .replace(/__cmux__cmuxLocation/g, '__cmuxLocation');

  return prefix + modified;
}

// HTMLRewriter to replace location in inline script tags
class ScriptRewriter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  element(element: any) {
    // Check if this is our injected script (has data-cmux-injected attribute)
    if (element.getAttribute('data-cmux-injected')) {
      return; // Skip our own scripts
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  text(text: any) {
    if (text.text) {
      const modified = rewriteJavaScript(text.text, false); // inline scripts
      if (modified !== text.text) {
        text.replace(modified, { html: false });
      }
    }
  }
}

class HeadRewriter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  element(element: any) {
    // Config script with localhost interceptors
    element.prepend(`<script data-cmux-injected="true">
// __CMUX_NO_REWRITE__ - This marker prevents this script from being rewritten
window.cmuxConfig = {
  taskRunId: "foo"
};

// Store the real location object (before any rewriting happens)
const __realLocation = window.location;

// Function to replace localhost URLs with cmux.sh proxy
function replaceLocalhostUrl(url) {
  try {
    const urlObj = new URL(url, __realLocation.href);
    if (urlObj.hostname === 'localhost' && urlObj.port) {
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
    // Special handling for Symbol properties
    if (prop === Symbol.toStringTag) {
      return 'Location';
    }
    if (prop === Symbol.toPrimitive) {
      return function(hint) {
        return __realLocation.href;
      };
    }

    // Handle methods that need URL rewriting
    if (prop === 'assign') {
      return function(url) {
        const newUrl = replaceLocalhostUrl(url);
        console.log('Intercepted location.assign via proxy:', url, '->', newUrl);
        return __realLocation.assign(newUrl);
      };
    }
    if (prop === 'replace') {
      return function(url) {
        const newUrl = replaceLocalhostUrl(url);
        console.log('Intercepted location.replace via proxy:', url, '->', newUrl);
        return __realLocation.replace(newUrl);
      };
    }
    if (prop === 'reload') {
      return function() {
        console.log('Intercepted location.reload via proxy');
        return __realLocation.reload.apply(__realLocation, arguments);
      };
    }

    // Handle toString specially
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

    // Handle all location properties - make sure they exist!
    // These are all the standard Location properties
    const locationProps = [
      'href', 'origin', 'protocol', 'host', 'hostname', 'port',
      'pathname', 'search', 'hash', 'username', 'password', 'searchParams'
    ];

    if (locationProps.includes(prop)) {
      return __realLocation[prop];
    }

    // Handle any other property access
    const value = __realLocation[prop];
    if (value !== undefined) {
      if (typeof value === 'function') {
        return value.bind(__realLocation);
      }
      return value;
    }

    // Return undefined for unknown properties
    return undefined;
  },
  set(target, prop, value) {
    if (prop === 'href') {
      const newUrl = replaceLocalhostUrl(value);
      console.log('Intercepted location.href assignment via proxy:', value, '->', newUrl);
      __realLocation.href = newUrl;
      return true;
    }

    // Allow setting other properties that are settable
    const settableProps = ['hash', 'search', 'pathname', 'port', 'hostname', 'host', 'protocol'];
    if (settableProps.includes(prop)) {
      // For these, we might want to check if they result in localhost URLs
      __realLocation[prop] = value;
      return true;
    }

    // Ignore attempts to set read-only properties
    return true;
  },
  has(target, prop) {
    // Report that we have all the properties that location has
    return prop in __realLocation;
  },
  ownKeys(target) {
    // Return all keys from real location for spread operator support
    return Object.keys(__realLocation);
  },
  getOwnPropertyDescriptor(target, prop) {
    // Return descriptor from real location
    return Object.getOwnPropertyDescriptor(__realLocation, prop);
  }
});

// Create global alias for debugging and iframe access
window.__cmuxLocation = __cmuxLocation;
window.__cmuxLocationProxy = __cmuxLocation; // Store the actual proxy separately
// Don't assign window.location directly as it might cause issues

// Create a global __cmuxLocation variable for bare references
try {
  Object.defineProperty(window, '__cmuxLocation', {
    value: __cmuxLocation,
    writable: false,
    configurable: true
  });
} catch (e) {
  // Already defined, that's fine
}

// Also set on parent and top for iframe access
try {
  if (window.parent && window.parent !== window) {
    window.parent.__cmuxLocation = __cmuxLocation;
  }
} catch (e) {
  // Cross-origin, can't access
}

try {
  if (window.top && window.top !== window) {
    window.top.__cmuxLocation = __cmuxLocation;
  }
} catch (e) {
  // Cross-origin, can't access
}

// Setup for future iframes
const originalGetElementById = document.getElementById;
if (originalGetElementById) {
  document.getElementById = function(id) {
    const element = originalGetElementById.call(this, id);
    if (element && element.tagName === 'IFRAME') {
      try {
        // Try to set __cmuxLocation on the iframe's contentWindow
        if (element.contentWindow) {
          element.contentWindow.__cmuxLocation = __cmuxLocation;
        }
      } catch (e) {
        // Cross-origin or not ready
      }
    }
    return element;
  };
}

// Override document.location too
try {
  Object.defineProperty(document, 'location', {
    get() { return __cmuxLocation; },
    set(value) {
      const newUrl = replaceLocalhostUrl(value);
      console.log('Intercepted document.location assignment:', value, '->', newUrl);
      __realLocation.href = newUrl;
    },
    configurable: true
  });
} catch (e) {
  console.log('Could not override document.location:', e.message);
}

// Also set document.__cmuxLocation for compatibility
document.__cmuxLocation = __cmuxLocation;

// Try to override window.location (this often fails but worth trying)
try {
  Object.defineProperty(window, 'location', {
    get() { return __cmuxLocation; },
    set(value) {
      if (typeof value === 'string') {
        const newUrl = replaceLocalhostUrl(value);
        console.log('Intercepted direct location assignment:', value, '->', newUrl);
        __realLocation.href = newUrl;
      } else {
        __realLocation = value;
      }
    },
    configurable: true
  });
} catch (e) {
  // Expected to fail in most browsers
  console.log('Could not override window.location (expected):', e.message);
}

// Intercept window.open
const originalOpen = window.open;
window.open = function(url, ...args) {
  const newUrl = replaceLocalhostUrl(url);
  console.log('Intercepted window.open:', url, '->', newUrl);
  return originalOpen.call(this, newUrl, ...args);
};

// Intercept anchor tag clicks
document.addEventListener('click', function(e) {
  const target = e.target.closest('a');
  if (target && target.href) {
    const originalHref = target.getAttribute('href');
    const newUrl = replaceLocalhostUrl(target.href);
    if (newUrl !== target.href) {
      e.preventDefault();
      console.log('Intercepted anchor click:', target.href, '->', newUrl);
      window.location.href = newUrl;
    }
  }
}, true);

// Intercept form submissions
document.addEventListener('submit', function(e) {
  const form = e.target;
  if (form && form.action) {
    const newAction = replaceLocalhostUrl(form.action);
    if (newAction !== form.action) {
      console.log('Intercepted form submission:', form.action, '->', newAction);
      form.action = newAction;
    }
  }
}, true);

// Intercept history.pushState and history.replaceState
const originalPushState = history.pushState;
history.pushState = function(state, title, url) {
  if (url) {
    const newUrl = replaceLocalhostUrl(url);
    console.log('Intercepted history.pushState:', url, '->', newUrl);
    return originalPushState.call(this, state, title, newUrl);
  }
  return originalPushState.apply(this, arguments);
};

const originalReplaceState = history.replaceState;
history.replaceState = function(state, title, url) {
  if (url) {
    const newUrl = replaceLocalhostUrl(url);
    console.log('Intercepted history.replaceState:', url, '->', newUrl);
    return originalReplaceState.call(this, state, title, newUrl);
  }
  return originalReplaceState.apply(this, arguments);
};


// Monitor for dynamically added elements with onclick handlers (wait for body to exist)
function startMutationObserver() {
  if (!document.body) {
    // If body doesn't exist yet, wait and try again
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
          // Note: We can't easily intercept inline onclick, but the location interceptors above should catch it
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
</script>`, { html: true });

    // Service worker registration script
    element.prepend(`<script data-cmux-injected="true">
// __CMUX_NO_REWRITE__ - This marker prevents this script from being rewritten
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/proxy-sw.js', { scope: '/' }).catch(console.error);
}
</script>`, { html: true });
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    // Root apex: reply with greeting
    if (host === "cmux.sh") {
      return new Response("cmux!", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const suffix = ".cmux.sh";
    if (host.endsWith(suffix)) {
      const sub = host.slice(0, -suffix.length);

      // Serve the service worker file
      if (url.pathname === "/proxy-sw.js") {
        return new Response(SERVICE_WORKER_JS, {
          headers: {
            "content-type": "application/javascript",
            "cache-control": "no-cache",
          },
        });
      }

      // Check if subdomain starts with "port-" (hacky heuristic for Morph routing)
      if (sub.startsWith("port-")) {
        // Format: port-<port>-<vmSlug> -> port-<port>-morphvm-<vmSlug>
        // Example: port-8101-j2z9smmu.cmux.sh -> port-8101-morphvm-j2z9smmu.http.cloud.morph.so
        const parts = sub.split("-");
        if (parts.length >= 3) {
          // Insert "morphvm" after the port number
          const morphSubdomain = `${parts[0]}-${parts[1]}-morphvm-${parts.slice(2).join("-")}`;
          const target = new URL(url.pathname + url.search, `https://${morphSubdomain}.http.cloud.morph.so`);

          const outbound = new Request(target, {
            method: request.method,
            headers: request.headers,
            body: request.body,
          });

          const response = await fetch(outbound);
          const contentType = response.headers.get("content-type") || "";

          // Apply HTMLRewriter to HTML responses
          if (contentType.includes("text/html")) {
            return new HTMLRewriter()
              .on("head", new HeadRewriter())
              .on("script", new ScriptRewriter())
              .transform(response);
          }

          // Rewrite JavaScript files
          if (contentType.includes("javascript") || url.pathname.endsWith(".js")) {
            const text = await response.text();
            const rewritten = rewriteJavaScript(text, true); // external files
            return new Response(rewritten, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          }

          return response;
        }
      }

      // Original routing logic for non-Morph subdomains
      const parts = sub.split("-").filter(Boolean);

      // Expect: <workspace...>-<port>-<vmSlug>
      if (parts.length < 3) {
        return new Response("Invalid cmux subdomain", { status: 400 });
      }

      const vmSlug = parts[parts.length - 1];
      const port = parts[parts.length - 2];
      const workspace = parts.slice(0, -2).join("-");

      if (!workspace) {
        return new Response("Missing workspace in subdomain", { status: 400 });
      }
      if (!/^\d+$/.test(port)) {
        return new Response("Invalid port in subdomain", { status: 400 });
      }

      const target = new URL(url.pathname + url.search, `https://${vmSlug}.vm.freestyle.sh`);

      // Copy headers and inject cmux internals, avoid mutating the original
      const headers = new Headers(request.headers);
      headers.set("X-Cmux-Workspace-Internal", workspace);
      headers.set("X-Cmux-Port-Internal", port);

      const outbound = new Request(target, {
        method: request.method,
        headers,
        body: request.body,
        // Cloudflare runtime keeps upgrades when using fetch(outbound)
      });

      const response = await fetch(outbound);
      const contentType = response.headers.get("content-type") || "";

      // Apply HTMLRewriter to HTML responses
      if (contentType.includes("text/html")) {
        return new HTMLRewriter()
          .on("head", new HeadRewriter())
          .on("script", new ScriptRewriter())
          .transform(response);
      }

      // Rewrite JavaScript files
      if (contentType.includes("javascript") || url.pathname.endsWith(".js")) {
        const text = await response.text();
        const rewritten = rewriteJavaScript(text, true); // external files
        return new Response(rewritten, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }

      return response;
    }

    // Not our domain — pass-through or block; pass-through by default
    return fetch(request);
  },
};

