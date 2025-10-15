import { describe, expect, it } from "vitest";

import { isLocalHostname } from "./is-local-host";

describe("isLocalHostname", () => {
  it("returns true for loopback hostnames", () => {
    const hosts = [
      "localhost",
      "LOCALHOST",
      "subdomain.localhost",
      "example.local",
      "127.0.0.1",
      "127.0.0.255",
      "127.255.255.255",
      "0.0.0.0",
      "::1",
      "[::1]",
      "::ffff:127.0.0.1",
      "[::ffff:127.0.0.1]",
    ];

    for (const host of hosts) {
      expect(isLocalHostname(host)).toBe(true);
    }
  });

  it("returns true for LAN IPv4 literals", () => {
    const hosts = [
      "10.0.0.5",
      "172.16.10.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "::ffff:192.168.0.20",
      "[::ffff:10.0.0.1]",
    ];

    for (const host of hosts) {
      expect(isLocalHostname(host)).toBe(true);
    }
  });

  it("returns false for non-local IPv4 addresses", () => {
    const hosts = ["8.8.8.8", "::ffff:8.8.4.4", "[::ffff:203.0.113.5]"];

    for (const host of hosts) {
      expect(isLocalHostname(host)).toBe(false);
    }
  });

  it("returns false for other hostnames", () => {
    const hosts: Array<string | null | undefined> = [
      "example.com",
      "api.internal",
      "",
      null,
      undefined,
    ];

    for (const host of hosts) {
      expect(isLocalHostname(host)).toBe(false);
    }
  });
});
