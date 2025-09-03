import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "path";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve("electron/main/index.ts"),
        },
      },
    },
    // Load env vars from repo root so NEXT_PUBLIC_* from .env/.env.local apply
    envDir: resolve("../../"),
    envPrefix: "NEXT_PUBLIC_",
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
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
    envDir: resolve("../../"),
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
    envDir: resolve("../../"),
    envPrefix: "NEXT_PUBLIC_",
  },
});
