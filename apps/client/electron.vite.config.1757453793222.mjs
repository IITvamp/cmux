// electron.vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";

// electron-vite-plugin-resolve-workspace.ts
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import "vite";
var __electron_vite_injected_import_meta_url = "file:///Users/lawrencechen/fun/cmux12/apps/client/electron-vite-plugin-resolve-workspace.ts";
var __dirname = dirname(fileURLToPath(__electron_vite_injected_import_meta_url));
function resolveWorkspacePackages() {
  return {
    name: "resolve-workspace-packages",
    enforce: "pre",
    resolveId(id, importer) {
      if (importer && importer.includes("apps/server/src/")) {
        if (id.startsWith("./") && id.endsWith(".js")) {
          const tsPath = resolvePath(
            dirname(importer),
            id.replace(/\.js$/, ".ts")
          );
          return tsPath;
        }
      }
      if (id.endsWith(".js") && id.includes("/apps/server/src/")) {
        const tsPath = id.replace(/\.js$/, ".ts");
        return tsPath;
      }
      if (id === "@cmux/convex/api") {
        return resolvePath(
          __dirname,
          "../../packages/convex/convex/_generated/api.js"
        );
      }
      if (id === "@cmux/server/realtime") {
        return resolvePath(__dirname, "../../apps/server/src/realtime.ts");
      }
      if (id === "@cmux/server/socket-handlers") {
        return resolvePath(
          __dirname,
          "../../apps/server/src/socket-handlers.ts"
        );
      }
      if (id === "@cmux/server/gitDiff") {
        return resolvePath(__dirname, "../../apps/server/src/gitDiff.ts");
      }
      if (id === "@cmux/server/server") {
        return resolvePath(__dirname, "../../apps/server/src/server.ts");
      }
      if (id === "@cmux/server") {
        return resolvePath(__dirname, "../../apps/server/src/index.ts");
      }
      if (id === "@cmux/server/electron-server") {
        return resolvePath(
          __dirname,
          "../../apps/server/src/electron-server.ts"
        );
      }
      if (id === "@cmux/shared" || id === "@cmux/shared/index") {
        return resolvePath(__dirname, "../../packages/shared/src/index.ts");
      }
      if (id === "@cmux/shared/socket") {
        return resolvePath(
          __dirname,
          "../../packages/shared/src/socket-client.ts"
        );
      }
      if (id === "@cmux/shared/node/socket") {
        return resolvePath(
          __dirname,
          "../../packages/shared/src/node/socket-server.ts"
        );
      }
      if (id === "@cmux/convex") {
        return resolvePath(
          __dirname,
          "../../packages/convex/convex/_generated/server.js"
        );
      }
      if (id.startsWith("@cmux/shared/")) {
        const subpath = id.slice("@cmux/shared/".length);
        return resolvePath(
          __dirname,
          `../../packages/shared/src/${subpath}.ts`
        );
      }
      return null;
    }
  };
}

// electron.vite.config.ts
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          "@cmux/server",
          "@cmux/server/**",
          "@cmux/shared",
          "@cmux/convex",
          "@cmux/www-openapi-client"
        ]
      }),
      resolveWorkspacePackages()
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve("electron/main/bootstrap.ts")
        }
      }
    },
    envPrefix: "NEXT_PUBLIC_"
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ["@cmux/server", "@cmux/server/**"]
      }),
      resolveWorkspacePackages()
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve("electron/preload/index.ts")
        },
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs"
        }
      }
    },
    envPrefix: "NEXT_PUBLIC_"
  },
  renderer: {
    root: ".",
    base: "./",
    build: {
      rollupOptions: {
        input: {
          index: resolve("index.html")
        }
      }
    },
    resolve: {
      alias: {
        "@": resolve("src")
      }
    },
    plugins: [
      tsconfigPaths(),
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true
      }),
      react(),
      tailwindcss()
    ],
    envPrefix: "NEXT_PUBLIC_"
  }
});
export {
  electron_vite_config_default as default
};
