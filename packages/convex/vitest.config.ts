import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "_shared/**/*.test.ts",
      "convex/**/*.test.ts",
    ],
  },
});

