import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Ensure all env is loaded
await import("./src/client-env.ts");

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  define: {
    "process.env": {},
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development"
    ),
    global: "globalThis",
  },
  envPrefix: "NEXT_PUBLIC_",
  // TODO: make this safe
  server: {
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const [firstOriginal] = assetInfo.originalFileNames ?? [];
          const [firstName] = assetInfo.names ?? [];

          const preferredName = firstOriginal ?? firstName ?? "";
          const normalizedName = preferredName
            .replace(/^.*node_modules\//, "node_modules/")
            .replace(/^\.\/?/, "");

          const nodeModulesPrefix = "node_modules/monaco-editor/min/vs/";
          const monacoPrefix = "monaco-editor/min/vs/";

          if (normalizedName.startsWith(nodeModulesPrefix)) {
            return normalizedName.slice("node_modules/".length);
          }

          if (normalizedName.startsWith(monacoPrefix)) {
            return normalizedName;
          }

          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});
