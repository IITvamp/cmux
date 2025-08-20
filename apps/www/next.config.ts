import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Ensure server bundles don't try to parse native addons
    serverComponentsExternalPackages: [
      "morphcloud",
      "ssh2",
      "node-ssh",
      "cpu-features",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = [
        "morphcloud",
        "ssh2",
        "node-ssh",
        "cpu-features",
      ];
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
