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

      return fetch(outbound);
    }

    // Not our domain — pass-through or block; pass-through by default
    return fetch(request);
  },
};

