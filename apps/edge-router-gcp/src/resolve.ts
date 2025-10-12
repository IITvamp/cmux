import type { IncomingHttpHeaders } from "node:http";

import { SERVICE_WORKER_JS } from "./rewriters.js";

export interface TargetResolvers {
  workspaceTarget(args: {
    workspace: string;
    vmSlug: string;
    port: string;
  }): string;
  morphPortTarget(args: { port: string; morphId: string }): string;
  morphScopeTarget(args: { morphId: string }): string;
}

const defaultResolvers: TargetResolvers = {
  workspaceTarget: ({ vmSlug }) => `https://${vmSlug}.vm.freestyle.sh`,
  morphPortTarget: ({ port, morphId }) =>
    `https://port-${port}-morphvm-${morphId}.http.cloud.morph.so`,
  morphScopeTarget: ({ morphId }) =>
    `https://port-39379-morphvm-${morphId}.http.cloud.morph.so`,
};

export interface RouterConfig {
  apexDomain: string;
  suffix: string;
  serviceWorkerPath: string;
  resolvers: TargetResolvers;
}

export const defaultRouterConfig: RouterConfig = {
  apexDomain: "cmux.sh",
  suffix: ".cmux.sh",
  serviceWorkerPath: "/proxy-sw.js",
  resolvers: defaultResolvers,
};

export interface DirectResponseDecision {
  kind: "direct";
  statusCode: number;
  body?: string | Buffer | null;
  headers?: Record<string, string>;
}

export interface ProxyDecision {
  kind: "proxy";
  targetOrigin: string;
  additionalRequestHeaders: Record<string, string>;
  skipServiceWorker: boolean;
  addPermissiveCors: boolean;
  removeMetaCsp: boolean;
  rewriteLoopbackHost?: (port: string) => string | null;
}

export type ResolveDecision = DirectResponseDecision | ProxyDecision;

export interface ResolveInput {
  method: string;
  pathname: string;
  search: string;
  hostname: string;
  headers: IncomingHttpHeaders;
  config?: RouterConfig;
}

function isAlreadyProxied(headers: IncomingHttpHeaders): boolean {
  const value = headers["x-cmux-proxied"] || headers["X-Cmux-Proxied" as keyof IncomingHttpHeaders];
  if (Array.isArray(value)) {
    return value.some((entry) => entry.toLowerCase() === "true");
  }
  return (value ?? "").toString().toLowerCase() === "true";
}

export function resolveRequest(input: ResolveInput): ResolveDecision | null {
  const {
    method,
    pathname,
    search,
    hostname,
    headers,
    config = defaultRouterConfig,
  } = input;

  const host = hostname.toLowerCase();

  if (host === config.apexDomain) {
    return {
      kind: "direct",
      statusCode: 200,
      body: "cmux!",
      headers: { "content-type": "text/plain; charset=utf-8" },
    };
  }

  if (!host.endsWith(config.suffix)) {
    return null;
  }

  const sub = host.slice(0, -config.suffix.length);

  if (pathname === config.serviceWorkerPath) {
    return {
      kind: "direct",
      statusCode: 200,
      body: SERVICE_WORKER_JS,
      headers: {
        "content-type": "application/javascript",
        "cache-control": "no-cache",
      },
    };
  }

  if (sub.startsWith("port-")) {
    if (sub.startsWith("port-39378") && method.toUpperCase() === "OPTIONS") {
      return {
        kind: "direct",
        statusCode: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods":
            "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
          "access-control-allow-headers": "*",
          "access-control-expose-headers": "*",
          "access-control-allow-credentials": "true",
          "access-control-max-age": "86400",
        },
      };
    }

    if (isAlreadyProxied(headers)) {
      return {
        kind: "direct",
        statusCode: 508,
        body: "Loop detected in proxy",
      };
    }

    const parts = sub.split("-");
    if (parts.length >= 3) {
      const portSegment = parts[1];
      const morphId = parts.slice(2).join("-");
      const targetOrigin = config.resolvers.morphPortTarget({
        port: portSegment,
        morphId,
      });

      const skipServiceWorker = sub.startsWith("port-39378");

      return {
        kind: "proxy",
        targetOrigin,
        additionalRequestHeaders: {
          "x-cmux-proxied": "true",
        },
        skipServiceWorker,
        addPermissiveCors: skipServiceWorker,
        removeMetaCsp: skipServiceWorker,
        rewriteLoopbackHost: (redirectPort: string) => {
          if (!redirectPort || !/^\d+$/.test(redirectPort)) {
            return null;
          }
          return `port-${redirectPort}-${morphId}.cmux.sh`;
        },
      };
    }
  }

  if (sub.startsWith("cmux-")) {
    if (isAlreadyProxied(headers)) {
      return {
        kind: "direct",
        statusCode: 508,
        body: "Loop detected in proxy",
      };
    }

    const remainder = sub.slice("cmux-".length);
    const segments = remainder.split("-");
    if (segments.length < 2) {
      return {
        kind: "direct",
        statusCode: 400,
        body: "Invalid cmux proxy subdomain",
      };
    }

    const portSegment = segments[segments.length - 1];
    if (!/^\d+$/.test(portSegment)) {
      return {
        kind: "direct",
        statusCode: 400,
        body: "Invalid port in cmux proxy subdomain",
      };
    }

    const morphId = segments[0];
    if (!morphId) {
      return {
        kind: "direct",
        statusCode: 400,
        body: "Missing morph id in cmux proxy subdomain",
      };
    }

    const scopeSegments = segments.slice(1, -1);
    const hasExplicitScope = scopeSegments.length > 0;
    const scopeRaw = hasExplicitScope ? scopeSegments.join("-") : "base";
    const isBaseScope =
      !hasExplicitScope ||
      (scopeSegments.length === 1 &&
        scopeSegments[0].toLowerCase() === "base");

    const targetOrigin = config.resolvers.morphScopeTarget({ morphId });

    const additionalRequestHeaders: Record<string, string> = {
      "x-cmux-proxied": "true",
      "x-cmux-port-internal": portSegment,
    };
    if (!isBaseScope) {
      additionalRequestHeaders["x-cmux-workspace-internal"] = scopeRaw;
    }

    return {
      kind: "proxy",
      targetOrigin,
      additionalRequestHeaders,
      skipServiceWorker: false,
      addPermissiveCors: false,
      removeMetaCsp: false,
      rewriteLoopbackHost: (redirectPort: string) => {
        if (!redirectPort || !/^\d+$/.test(redirectPort)) {
          return null;
        }
        const scopeLabel = isBaseScope ? "base" : scopeRaw;
        return `cmux-${morphId}-${scopeLabel}-${redirectPort}.cmux.sh`;
      },
    };
  }

  const parts = sub.split("-").filter(Boolean);
  if (parts.length < 3) {
    return {
      kind: "direct",
      statusCode: 400,
      body: "Invalid cmux subdomain",
    };
  }

  if (isAlreadyProxied(headers)) {
    return {
      kind: "direct",
      statusCode: 508,
      body: "Loop detected in proxy",
    };
  }

  const vmSlug = parts[parts.length - 1];
  const port = parts[parts.length - 2];
  const workspace = parts.slice(0, -2).join("-");

  if (!workspace) {
    return {
      kind: "direct",
      statusCode: 400,
      body: "Missing workspace in subdomain",
    };
  }

  if (!/^\d+$/.test(port)) {
    return {
      kind: "direct",
      statusCode: 400,
      body: "Invalid port in subdomain",
    };
  }

  const targetOrigin = config.resolvers.workspaceTarget({
    workspace,
    port,
    vmSlug,
  });

  return {
    kind: "proxy",
    targetOrigin,
    additionalRequestHeaders: {
      "x-cmux-workspace-internal": workspace,
      "x-cmux-port-internal": port,
      "x-cmux-proxied": "true",
    },
    skipServiceWorker: false,
    addPermissiveCors: sub.startsWith("port-39378"),
    removeMetaCsp: sub.startsWith("port-39378"),
    rewriteLoopbackHost: (redirectPort: string) => {
      if (!redirectPort || !/^\d+$/.test(redirectPort)) {
        return null;
      }
      return `${workspace}-${redirectPort}-${vmSlug}.cmux.sh`;
    },
  };
}
