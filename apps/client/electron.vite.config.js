import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolveWorkspacePackages } from "./electron-vite-plugin-resolve-workspace.js";

const envDir = resolve("../../");

export default defineConfig({
  main: {
    // Externalize deps from node_modules and resolve workspace packages
    plugins: [
      externalizeDepsPlugin(),
      resolveWorkspacePackages(),
    ],

    build: {
      rollupOptions: {
        input: {
          index: resolve("electron/main/index.ts"),
        },
        // Avoid bundling native and perf optional deps; load at runtime
        // Also externalize docker libs which pull in ssh2 (native optional binding)
        external: [
          /\.node$/, // native addons
          "cpu-features",
          "ssh2",
          "dockerode",
          "docker-modem",
          "bufferutil",
          "utf-8-validate",
        ],
      },
    },
    // Load env vars from repo root so NEXT_PUBLIC_* from .env/.env.local apply
    envDir,
    envPrefix: "NEXT_PUBLIC_",
  },
  preload: {
    plugins: [
      externalizeDepsPlugin(),
      resolveWorkspacePackages(),
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve("electron/preload/index.ts"),
        },
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
    envDir,
    envPrefix: "NEXT_PUBLIC_",
  },
  renderer: {
    root: ".",
    base: "./",
    build: {
      rollupOptions: {
        input: {
          index: resolve("index.html"),
        },
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
    envDir,
    envPrefix: "NEXT_PUBLIC_",
  },
});
