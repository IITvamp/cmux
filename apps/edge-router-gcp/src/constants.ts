export const SERVICE_WORKER_JS = `

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

  return /^127(?:\\.\\d{1,3}){3}$/.test(hostname);
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

export const CONFIG_SCRIPT = `<script data-cmux-injected="true">
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

  return /^127(?:\\.\\d{1,3}){3}$/.test(hostname);
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
      __realLocation.href = newUrl;
    },
    configurable: true
  });
} catch (e) {
  // Already defined, that's fine
}

// Patch history methods to rewrite URLs
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
</script>`;

export const SERVICE_WORKER_REGISTRATION_SCRIPT = `<script data-cmux-injected="true">
// __CMUX_NO_REWRITE__ - This marker prevents this script from being rewritten
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/proxy-sw.js', { scope: '/' }).catch(console.error);
}
</script>`;
