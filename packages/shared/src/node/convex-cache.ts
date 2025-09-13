import { ConvexHttpClient } from "convex/browser";
import { decodeJwt } from "jose";

interface CacheEntry {
  client: ConvexHttpClient;
  expiry: number;
  accessToken: string;
}

class ConvexClientCache {
  private cache = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60 * 1000); // Clean up every minute
  }

  private cleanupExpired(): void {
    const now = Date.now() / 1000;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry < now) {
        this.cache.delete(key);
      }
    }
  }

  private getCacheKey(accessToken: string, convexUrl: string): string | null {
    try {
      const jwt = decodeJwt(accessToken);
      // Use sub (subject), iat (issued at) and URL as unique key
      const sub = jwt.sub || "";
      const iat = jwt.iat || 0;
      return `${sub}-${iat}-${convexUrl}`;
    } catch (error) {
      console.warn("Failed to decode JWT for cache key:", error);
      return null;
    }
  }

  get(accessToken: string, convexUrl: string): ConvexHttpClient | null {
    const cacheKey = this.getCacheKey(accessToken, convexUrl);
    if (!cacheKey) {
      return null;
    }

    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return null;
    }

    // Check if token is expired
    const now = Date.now() / 1000;
    if (entry.expiry < now) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Verify token hasn't changed
    if (entry.accessToken !== accessToken) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.client;
  }

  set(accessToken: string, convexUrl: string, client: ConvexHttpClient): void {
    const cacheKey = this.getCacheKey(accessToken, convexUrl);
    if (!cacheKey) {
      return;
    }

    try {
      const jwt = decodeJwt(accessToken);
      const expiry = jwt.exp || Date.now() / 1000 + 3600; // Default to 1 hour if no exp

      this.cache.set(cacheKey, {
        client,
        expiry,
        accessToken,
      });
    } catch (error) {
      console.warn("Failed to cache Convex client:", error);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

export const convexClientCache = new ConvexClientCache();
