import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Middleware to handle cmux.app subdomain routing
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = url.hostname.toLowerCase();

  // Only handle cmux.app hostnames
  if (hostname === "cmux.app") {
    return new NextResponse("cmux!", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const suffix = ".cmux.app";
  if (hostname.endsWith(suffix)) {
    const subdomain = hostname.slice(0, -suffix.length);
    const parts = subdomain.split("-").filter(Boolean);

    // Expect at least: <workspace>-<port>-<vmSlug>
    if (parts.length < 3) {
      return NextResponse.json({ error: "Invalid cmux subdomain" }, { status: 400 });
    }

    const vmSlug = parts[parts.length - 1];
    const portStr = parts[parts.length - 2];
    const workspace = parts.slice(0, -2).join("-");

    if (!workspace) {
      return NextResponse.json({ error: "Missing workspace in subdomain" }, { status: 400 });
    }

    if (!/^\d+$/.test(portStr)) {
      return NextResponse.json({ error: "Invalid port in subdomain" }, { status: 400 });
    }

    const target = new URL(url.pathname + url.search, `https://${vmSlug}.vm.freestyle.sh`);

    // Forward original headers plus required internal headers
    const headers = new Headers(request.headers);
    headers.set("X-Cmux-Workspace-Internal", workspace);
    headers.set("X-Cmux-Port-Internal", portStr);

    return NextResponse.rewrite(target, { request: { headers } });
  }

  // Not a cmux.app request — continue
  return NextResponse.next();
}

// Apply to all routes so host-based handling works everywhere
export const config = {
  matcher: "/:path*",
};

