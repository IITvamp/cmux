import { describe, expect, it } from "vitest";
import config from "./electron.vite.config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, PluginOption } from "vite";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

function isPlugin(value: PluginOption): value is Plugin {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectPlugins(option: PluginOption | PluginOption[] | undefined): Plugin[] {
  if (!option) {
    return [];
  }
  if (Array.isArray(option)) {
    return option.flatMap((entry) => collectPlugins(entry));
  }
  return isPlugin(option) ? [option] : [];
}

function flattenPlugins(plugins: PluginOption[] | undefined): Plugin[] {
  if (!plugins) {
    return [];
  }
  return plugins.flatMap((pluginOption) => collectPlugins(pluginOption));
}

function findPluginByName(plugins: PluginOption[] | undefined, pluginName: string): Plugin | undefined {
  return flattenPlugins(plugins).find((plugin) => plugin.name === pluginName);
}

function readExcludeList(plugin: Plugin | undefined): string[] {
  if (!plugin) {
    return [];
  }
  const rawExclude = (plugin as { exclude?: unknown }).exclude;
  if (!Array.isArray(rawExclude)) {
    return [];
  }
  return rawExclude.filter((value): value is string => typeof value === "string");
}

describe("electron.vite.config", () => {
  it("shares the repo env configuration across targets", () => {
    expect(config.main?.envDir).toBe(repoRoot);
    expect(config.preload?.envDir).toBe(repoRoot);
    expect(config.renderer?.envDir).toBe(repoRoot);

    expect(config.main?.envPrefix).toBe("NEXT_PUBLIC_");
    expect(config.preload?.envPrefix).toBe("NEXT_PUBLIC_");
    expect(config.renderer?.envPrefix).toBe("NEXT_PUBLIC_");
  });

  it("registers plugins required for bundling workspace packages", () => {
    const mainResolver = findPluginByName(config.main?.plugins, "resolve-workspace-packages");
    const preloadResolver = findPluginByName(config.preload?.plugins, "resolve-workspace-packages");

    expect(mainResolver).toBeDefined();
    expect(preloadResolver).toBeDefined();

    const mainExternalize = findPluginByName(config.main?.plugins, "externalize-deps");
    const preloadExternalize = findPluginByName(config.preload?.plugins, "externalize-deps");

    expect(mainExternalize).toBeDefined();
    expect(preloadExternalize).toBeDefined();

    expect(readExcludeList(mainExternalize)).toEqual(
      expect.arrayContaining([
        "@cmux/server",
        "@cmux/server/**",
        "@cmux/shared",
        "@cmux/convex",
        "@cmux/www-openapi-client",
      ])
    );
    expect(readExcludeList(preloadExternalize)).toEqual(
      expect.arrayContaining(["@cmux/server", "@cmux/server/**"])
    );
  });

  it("defines the expected entry points and aliases", () => {
    expect(config.main?.build?.rollupOptions?.input).toMatchObject({
      index: resolve("electron/main/bootstrap.ts"),
    });
    expect(config.preload?.build?.rollupOptions?.input).toMatchObject({
      index: resolve("electron/preload/index.ts"),
    });
    expect(config.renderer?.build?.rollupOptions?.input).toMatchObject({
      index: resolve("index.html"),
    });

    expect(config.renderer?.resolve?.alias).toMatchObject({
      "@": resolve("src"),
    });
  });
});
