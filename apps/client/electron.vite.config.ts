import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolveWorkspacePackages } from "./electron-vite-plugin-resolve-workspace.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          "@cmux/server",
          "@cmux/server/**",
          "@cmux/shared",
          "@cmux/convex",
          "@cmux/www-openapi-client",
        ],
      }),
      resolveWorkspacePackages(),
    ],
    envDir: repoRoot,
    build: {
      rollupOptions: {
        input: {
          index: resolve("electron/main/bootstrap.ts"),
        },
        treeshake: "smallest",
      },
    },
    envPrefix: "NEXT_PUBLIC_",
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ["@cmux/server", "@cmux/server/**"],
      }),
      resolveWorkspacePackages(),
    ],
    envDir: repoRoot,
    build: {
      rollupOptions: {
        input: {
          index: resolve("electron/preload/index.ts"),
        },
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
        treeshake: "smallest",
      },
    },
    envPrefix: "NEXT_PUBLIC_",
  },
  renderer: {
    root: ".",
    envDir: repoRoot,
    base: "./",
    build: {
      rollupOptions: {
        input: {
          index: resolve("index.html"),
        },
        treeshake: "smallest",
      },
    },
    resolve: {
      alias: {
        "@": resolve("src"),
      },
    },
    plugins: [
      tsconfigPaths(),
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
    ],
    envPrefix: "NEXT_PUBLIC_",
  },
});
