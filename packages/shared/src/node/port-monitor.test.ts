import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PortMonitor } from "./port-monitor";

describe("PortMonitor", () => {
  let monitor: PortMonitor;

  beforeEach(() => {
    monitor = new PortMonitor(100); // Fast polling for tests
  });

  afterEach(() => {
    monitor.stop();
  });

  it("should detect dev servers on common ports", () => {
    const mockProcessInfo = {
      port: 3000,
      processName: "node",
      pid: 1234,
      command: "node server.js"
    };

    const detection = (monitor as any).detectDevServer(mockProcessInfo);
    expect(detection).toBeTruthy();
    expect(detection!.port).toBe(3000);
    expect(detection!.url).toBe("http://localhost:3000");
    expect(detection!.confidence).toBeGreaterThan(0.5);
  });

  it("should not detect dev servers on non-dev ports", () => {
    const mockProcessInfo = {
      port: 22,
      processName: "sshd",
      pid: 567,
      command: "sshd"
    };

    const detection = (monitor as any).detectDevServer(mockProcessInfo);
    expect(detection).toBeNull();
  });

  it("should have high confidence for known dev server processes", () => {
    const mockProcessInfo = {
      port: 5173,
      processName: "vite",
      pid: 1234,
      command: "vite dev"
    };

    const detection = (monitor as any).detectDevServer(mockProcessInfo);
    expect(detection).toBeTruthy();
    expect(detection!.confidence).toBeGreaterThan(0.8);
  });
});