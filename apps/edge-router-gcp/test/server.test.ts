import http from "node:http";

import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createEdgeRouterServer } from "../src/server.js";
import { RouterConfig, defaultRouterConfig } from "../src/resolve.js";

let originServer: http.Server;
let originPort = 0;
let lastRequestHeaders: http.IncomingHttpHeaders = {};

let edgeServer: http.Server;
let requestAgent: supertest.SuperTest<supertest.Test>;

beforeAll(async () => {
  originServer = http.createServer((req, res) => {
    lastRequestHeaders = req.headers;

    if (!req.url) {
      res.statusCode = 500;
      res.end("missing url");
      return;
    }

    if (req.url.startsWith("/html")) {
      res.setHeader("content-type", "text/html");
      res.end(
        "<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>"
      );
      return;
    }

    if (req.url.startsWith("/script.js")) {
      res.setHeader("content-type", "application/javascript");
      res.end("console.log(window.location.href);");
      return;
    }

    if (req.url.startsWith("/redirect")) {
      res.statusCode = 302;
      res.setHeader("location", "http://127.0.0.1:7777/after");
      res.end();
      return;
    }

    res.setHeader("content-type", "text/plain");
    res.end("ok");
  });

  await new Promise<void>((resolve) => {
    originServer.listen(0, "127.0.0.1", () => {
      const address = originServer.address();
      if (address && typeof address === "object") {
        originPort = address.port;
      }
      resolve();
    });
  });

  const routerConfig: RouterConfig = {
    ...defaultRouterConfig,
    resolvers: {
      workspaceTarget: () => `http://127.0.0.1:${originPort}`,
      morphPortTarget: () => `http://127.0.0.1:${originPort}`,
      morphScopeTarget: () => `http://127.0.0.1:${originPort}`,
    },
  };

  const edge = createEdgeRouterServer({
    routerConfig,
    allowInsecureTarget: true,
  });

  edgeServer = edge.server;

  requestAgent = supertest(edgeServer);
});

afterAll(async () => {
  await new Promise<void>((resolve) => edgeServer.close(() => resolve()));
  await new Promise<void>((resolve) => originServer.close(() => resolve()));
});

describe("edge router http behaviour", () => {
  it("returns greeting for apex domain", async () => {
    const response = await requestAgent.get("/").set("Host", "cmux.sh");
    expect(response.status).toBe(200);
    expect(response.text).toBe("cmux!");
  });

  it("serves service worker script", async () => {
    const response = await requestAgent
      .get("/proxy-sw.js")
      .set("Host", "foo.cmux.sh");
    expect(response.status).toBe(200);
    expect(response.text).toContain("self.addEventListener('fetch'");
  });

  it("injects cmux head scripts into html responses", async () => {
    const response = await requestAgent
      .get("/html")
      .set("Host", "workspace-3000-testvm.cmux.sh");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.text).toContain("window.cmuxConfig");
    expect(response.text).toContain("navigator.serviceWorker.register");
    expect(lastRequestHeaders["x-cmux-workspace-internal"]).toBe("workspace");
    expect(lastRequestHeaders["x-cmux-port-internal"]).toBe("3000");
  });

  it("rewrites javascript responses", async () => {
    const response = await requestAgent
      .get("/script.js")
      .set("Host", "workspace-3000-testvm.cmux.sh");

    expect(response.status).toBe(200);
    expect(response.text).toContain("window.__cmuxLocation");
    expect(lastRequestHeaders["x-cmux-proxied"]).toBe("true");
  });

  it("rewrites loopback redirects for morph ports", async () => {
    const response = await requestAgent
      .get("/redirect")
      .set("Host", "port-8080-demo.cmux.sh");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      "https://port-7777-demo.cmux.sh/after"
    );
  });

  it("handles preflight for port-39378", async () => {
    const response = await requestAgent
      .options("/anything")
      .set("Host", "port-39378-demo.cmux.sh");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });
});
