import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile our local package so importing TS works without extra setup
  transpilePackages: ["@cmux/preview-comments"],
};

export default nextConfig;
