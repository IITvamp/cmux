import { describe, expect, it } from "vitest";
import {
  isCommonDevPort,
  isLikelyDevServerCandidate,
  matchesDevServerCommand,
} from "./devServerHeuristics";

describe("dev server heuristics", () => {
  it("recognizes common dev ports", () => {
    expect(isCommonDevPort(3000)).toBe(true);
    expect(isCommonDevPort(5173)).toBe(true);
    expect(isCommonDevPort(1500)).toBe(false);
  });

  it("matches typical dev commands", () => {
    expect(matchesDevServerCommand("npm run dev")).toBe(true);
    expect(matchesDevServerCommand("python manage.py runserver")).toBe(true);
    expect(matchesDevServerCommand("go run main.go")).toBe(true);
    expect(matchesDevServerCommand("node server.js")).toBe(false);
  });

  it("classifies likely dev server candidates", () => {
    expect(
      isLikelyDevServerCandidate({
        port: 3000,
        processName: "node",
        cmdline: "npm run dev",
      }),
    ).toBe(true);

    expect(
      isLikelyDevServerCandidate({
        port: 8000,
        processName: "python3",
        cmdline: "python3 manage.py runserver",
      }),
    ).toBe(true);

    expect(
      isLikelyDevServerCandidate({
        port: 39382,
        processName: "chrome",
        cmdline: "chrome --remote-debugging-port=39382",
      }),
    ).toBe(false);

    expect(
      isLikelyDevServerCandidate({
        port: 45083,
        processName: "containerd",
        cmdline: "/usr/bin/containerd",
      }),
    ).toBe(false);

    expect(
      isLikelyDevServerCandidate({
        port: 3001,
        processName: "node",
        cmdline: null,
      }),
    ).toBe(true);
  });
});
