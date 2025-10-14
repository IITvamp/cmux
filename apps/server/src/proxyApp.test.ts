import { describe, expect, test, vi, beforeEach } from "vitest";
import express from "express";
import * as proxyApp from "./proxyApp";
import type { Request } from "express";

const { rewriteCorsHeaders } = proxyApp;

// Mock httpProxy
const mockProxyOn = vi.fn();
const mockProxyWeb = vi.fn();
vi.mock("http-proxy", () => ({
  default: {
    createProxyServer: vi.fn(() => ({
      web: mockProxyWeb,
      on: mockProxyOn,
      ws: vi.fn(),
    })),
  },
}));


vi.mock("./vscode/DockerVSCodeInstance", () => ({
  DockerVSCodeInstance: {
    getDocker: vi.fn(() => ({
      listContainers: mockListContainers,
      getContainer: vi.fn(() => ({
        inspect: mockInspect,
      })),
    })),
  },
}));

// Mock convexClient
vi.mock("./utils/convexClient", () => ({
  getConvex: vi.fn(() => ({
    query: vi.fn().mockResolvedValue(null),
  })),
}));

// Mock fileLogger
vi.mock("./utils/fileLogger", () => ({
  serverLogger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock VSCodeInstance
vi.mock("./vscode/VSCodeInstance", () => ({
  VSCodeInstance: {
    getInstance: vi.fn(),
  },
}));

// Mock getActualPortFromDocker
vi.spyOn(proxyApp, 'getActualPortFromDocker').mockResolvedValue("39378");

describe("rewriteCorsHeaders", () => {
  test("should rewrite Access-Control-Allow-Origin to the requesting origin", () => {
    const mockProxyRes = {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST',
      },
    };

    const mockReq = {
      headers: {
        origin: 'https://example.subdomain.localhost:9776',
      },
    } as Request;

    rewriteCorsHeaders(mockProxyRes, mockReq);

    expect(mockProxyRes.headers['access-control-allow-origin']).toBe('https://example.subdomain.localhost:9776');
    expect(mockProxyRes.headers['access-control-allow-methods']).toBe('GET, POST');
  });

  test("should not rewrite if no origin header", () => {
    const mockProxyRes = {
      headers: {
        'access-control-allow-origin': '*',
      },
    };

    const mockReq = {
      headers: {},
    } as Request;

    rewriteCorsHeaders(mockProxyRes, mockReq);

    expect(mockProxyRes.headers['access-control-allow-origin']).toBe('*');
  });
});