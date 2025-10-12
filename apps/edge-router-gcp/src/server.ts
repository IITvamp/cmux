import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pipeline } from "node:stream";
import { promisify } from "node:util";

import httpProxy from "http-proxy";

import {
  addPermissiveCors,
  headersToMutable,
  sanitizeRewrittenResponseHeaders,
  stripCspHeaders,
  MutableHeaders,
} from "./headers.js";
import {
  rewriteHtmlDocument,
  rewriteJavaScript,
} from "./rewriters.js";
import {
  defaultRouterConfig,
  ProxyDecision,
  ResolveDecision,
  resolveRequest,
  RouterConfig,
} from "./resolve.js";
import { rewriteLoopbackRedirect } from "./utils.js";

const pump = promisify(pipeline);

interface ExtendedIncomingMessage extends IncomingMessage {
  __edgeDecision?: ProxyDecision;
}

export interface EdgeRouterServerOptions {
  routerConfig?: RouterConfig;
  allowInsecureTarget?: boolean;
  requestTimeoutMs?: number;
  logger?: Pick<typeof console, "error" | "warn" | "info">;
}

export interface EdgeRouterServer {
  server: http.Server;
  proxy: httpProxy;
}

function collectResponseBody(stream: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", (error) => reject(error));
  });
}

function shouldRewriteJavaScript(
  req: IncomingMessage,
  headers: MutableHeaders
): boolean {
  const contentType = headers["content-type"] ?? "";
  if (contentType.includes("javascript")) {
    return true;
  }

  const urlPath = (req.url ?? "").split("?")[0] ?? "";
  return urlPath.endsWith(".js");
}

function shouldRewriteHtml(headers: MutableHeaders): boolean {
  const contentType = headers["content-type"] ?? "";
  return contentType.includes("text/html");
}

function sendDirectResponse(
  res: ServerResponse,
  decision: ResolveDecision
): void {
  if (decision.kind !== "direct") {
    throw new Error("sendDirectResponse called with non-direct decision");
  }

  const statusCode = decision.statusCode;
  const headers = decision.headers ?? {};
  res.writeHead(statusCode, headers);
  if (decision.body === undefined || decision.body === null) {
    res.end();
    return;
  }

  res.end(decision.body);
}

function createProxy({
  allowInsecureTarget,
}: {
  allowInsecureTarget: boolean;
}): httpProxy {
  return httpProxy.createProxyServer({
    selfHandleResponse: true,
    changeOrigin: true,
    xfwd: true,
    ws: true,
    secure: !allowInsecureTarget,
  });
}

export function createEdgeRouterServer(
  options: EdgeRouterServerOptions = {}
): EdgeRouterServer {
  const {
    routerConfig = defaultRouterConfig,
    allowInsecureTarget = false,
    requestTimeoutMs = 30_000,
    logger = console,
  } = options;

  const proxy = createProxy({ allowInsecureTarget });

  proxy.on("error", (error, _req, res) => {
    if (!res || res.writableEnded) {
      logger.error?.("Proxy error without writable response", error);
      return;
    }
    logger.error?.("Proxy error", error);
    res.writeHead?.(502, { "content-type": "text/plain" });
    res.end?.("Bad gateway");
  });

  proxy.on("proxyReq", (proxyReq, req) => {
    const decision = (req as ExtendedIncomingMessage).__edgeDecision;
    if (!decision || decision.kind !== "proxy") {
      return;
    }

    for (const [key, value] of Object.entries(
      decision.additionalRequestHeaders
    )) {
      proxyReq.setHeader(key, value);
    }
  });

  proxy.on("proxyReqWs", (proxyReq, req) => {
    const decision = (req as ExtendedIncomingMessage).__edgeDecision;
    if (!decision || decision.kind !== "proxy") {
      return;
    }

    for (const [key, value] of Object.entries(
      decision.additionalRequestHeaders
    )) {
      proxyReq.setHeader(key, value);
    }
  });

  proxy.on("proxyRes", async (proxyRes, req, res) => {
    const decision = (req as ExtendedIncomingMessage).__edgeDecision;
    if (!decision || decision.kind !== "proxy") {
      if (!res.headersSent) {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      }
      await pump(proxyRes, res);
      return;
    }

    let headers = headersToMutable(proxyRes.headers);

    if (decision.rewriteLoopbackHost) {
      headers = rewriteLoopbackRedirect(headers, decision.rewriteLoopbackHost);
    }

    headers = stripCspHeaders(headers);

    if (decision.addPermissiveCors) {
      headers = addPermissiveCors(headers);
    }

    const statusCode = proxyRes.statusCode ?? 502;
    const method = (req.method ?? "GET").toUpperCase();

    const isHead = method === "HEAD";
    const rewriteHtml = !isHead && shouldRewriteHtml(headers);
    const rewriteJs = !isHead && shouldRewriteJavaScript(req, headers);

    if (rewriteHtml || rewriteJs) {
      try {
        const bodyBuffer = await collectResponseBody(proxyRes);
        const bodyText = bodyBuffer.toString("utf8");

        let rewrittenBody = bodyText;
        if (rewriteHtml) {
          rewrittenBody = rewriteHtmlDocument(bodyText, {
            skipServiceWorker: decision.skipServiceWorker,
            removeMetaCsp: decision.removeMetaCsp,
          });
        } else {
          rewrittenBody = rewriteJavaScript(bodyText, true);
        }

        let mutatedHeaders = sanitizeRewrittenResponseHeaders(headers);
        mutatedHeaders["content-type"] = headers["content-type"] ??
          (rewriteHtml ? "text/html" : "application/javascript");

        res.writeHead(statusCode, mutatedHeaders);
        res.end(rewrittenBody);
        return;
      } catch (error) {
        logger.error?.("Failed to rewrite response body", error);
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("Failed to rewrite response");
        return;
      }
    }

    res.writeHead(statusCode, headers);
    await pump(proxyRes, res);
  });

  const server = http.createServer((req, res) => {
    const hostHeader = req.headers.host;
    if (!hostHeader) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("Missing Host header");
      return;
    }

    const [hostname] = hostHeader.split(":");
    const baseUrl = `http://${hostHeader}`;
    const requestUrl = new URL(req.url ?? "/", baseUrl);

    const decision = resolveRequest({
      method: req.method ?? "GET",
      pathname: requestUrl.pathname,
      search: requestUrl.search,
      hostname,
      headers: req.headers,
      config: routerConfig,
    });

    if (!decision) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }

    if (decision.kind === "direct") {
      sendDirectResponse(res, decision);
      return;
    }

    (req as ExtendedIncomingMessage).__edgeDecision = decision;

    const target = decision.targetOrigin;
    const proxyOptions: httpProxy.ServerOptions = {
      target,
      secure: !allowInsecureTarget,
      changeOrigin: true,
      selfHandleResponse: true,
      xfwd: true,
      headers: decision.additionalRequestHeaders,
    };

    proxy.web(req, res, proxyOptions);
  });

  server.requestTimeout = requestTimeoutMs;
  server.headersTimeout = requestTimeoutMs + 5000;

  server.on("upgrade", (req, socket, head) => {
    const hostHeader = req.headers.host;
    if (!hostHeader) {
      socket.destroy();
      return;
    }

    const [hostname] = hostHeader.split(":");
    const baseUrl = `http://${hostHeader}`;
    const requestUrl = new URL(req.url ?? "/", baseUrl);

    const decision = resolveRequest({
      method: req.method ?? "GET",
      pathname: requestUrl.pathname,
      search: requestUrl.search,
      hostname,
      headers: req.headers,
      config: routerConfig,
    });

    if (!decision || decision.kind !== "proxy") {
      socket.destroy();
      return;
    }

    (req as ExtendedIncomingMessage).__edgeDecision = decision;

    proxy.ws(req, socket, head, {
      target: decision.targetOrigin,
      secure: !allowInsecureTarget,
      changeOrigin: true,
      selfHandleResponse: false,
      xfwd: true,
      headers: decision.additionalRequestHeaders,
    });
  });

  return { server, proxy };
}
