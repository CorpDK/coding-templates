import type { NextConfig } from "next";

const DS_HTTP_URL = process.env.DS_HTTP_URL;
if (!DS_HTTP_URL) throw new Error("DS_HTTP_URL env var is required");

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/graphql/:path*",
        destination: `${DS_HTTP_URL}/graphql/:path*`,
      },
    ];
  },
};

export default nextConfig;
