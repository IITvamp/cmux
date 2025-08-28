import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    VITE_STACK_PROJECT_ID: process.env.VITE_STACK_PROJECT_ID,
    VITE_STACK_PUBLISHABLE_CLIENT_KEY:
      process.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
    VITE_WWW_ORIGIN: process.env.VITE_WWW_ORIGIN,
  },
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
