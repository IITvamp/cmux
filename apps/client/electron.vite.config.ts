import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolveWorkspacePackages } from "./electron-vite-plugin-resolve-workspace.ts";

const envDir = resolve("../../");

// Load environment variables from .env files
const loadEnv = () => {
  const envVars: Record<string, string> = {};
  // Read from process.env which should have been populated by dotenv-cli
  for (const key in process.env) {
    if (key.startsWith("NEXT_PUBLIC_")) {
      envVars[`import.meta.env.${key}`] = JSON.stringify(process.env[key]);
    }
  }
  return envVars;
};

const envDefines = loadEnv();

export default defineConfig({
  main: {
    // Externalize deps from node_modules (except @cmux/server) and resolve workspace packages
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
    define: envDefines,
    build: {
      rollupOptions: {
        input: {
          index: resolve("electron/main/bootstrap.ts"),
        },
        // Avoid bundling native and perf optional deps; load at runtime
        // Also externalize docker libs which pull in ssh2 (native optional binding)
        // But DO NOT externalize @cmux/server - we want it bundled
        // external: (id) => {
        //   // Don't externalize @cmux/server modules
        //   if (id.startsWith("@cmux/server")) {
        //     return false;
        //   }
        //   // Externalize native modules and specific deps
        //   if (/\.node$/.test(id)) return true;
        //   if (
        //     [
        //       "cpu-features",
        //       "ssh2",
        //       "dockerode",
        //       "docker-modem",
        //       "bufferutil",
        //       "utf-8-validate",
        //     ].includes(id)
        //   ) {
        //     return true;
        //   }
        //   return false;
        // },
      },
    },
    // Load env vars from repo root so NEXT_PUBLIC_* from .env/.env.local apply
    envDir,
    envPrefix: "NEXT_PUBLIC_",
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ["@cmux/server", "@cmux/server/**"],
      }),
      resolveWorkspacePackages(),
    ],
    define: envDefines,
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
    define: envDefines,
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
