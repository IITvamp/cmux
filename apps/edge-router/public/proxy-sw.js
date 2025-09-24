console.log('Service worker loaded');

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
    const morphIdMatch = currentHost.match(/port-\d+-(.*?)\.cmux\.sh/);

    if (morphIdMatch) {
      const morphId = morphIdMatch[1];
      // Redirect to port-PORT-[morphid].cmux.sh
      const redirectUrl = `https://port-${url.port}-${morphId}.cmux.sh${url.pathname}${url.search}`;

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
});