import dotenv from "dotenv";
import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Load root .env so tests have Stack and GitHub env values
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
  },
  envPrefix: "NEXT_PUBLIC_",
});
