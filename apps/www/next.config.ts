import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const openapiClientEntry = join(
  repoRoot,
  "packages",
  "www-openapi-client",
  "dist",
  "client",
  "client.gen.js"
);

if (!existsSync(openapiClientEntry)) {
  execFileSync("bun", ["run", "build"], {
    cwd: join(repoRoot, "packages", "www-openapi-client"),
    stdio: "inherit",
  });
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["morphcloud", "ssh2", "node-ssh", "cpu-features"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = ["morphcloud", "ssh2", "node-ssh", "cpu-features"];
      config.externals = Array.isArray(config.externals)
        ? [...config.externals, ...externals]
        : config.externals
          ? [config.externals, ...externals]
          : externals;
    }
    return config;
  },
};

export default nextConfig;
