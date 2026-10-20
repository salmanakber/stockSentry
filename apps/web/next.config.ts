import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@stocksentry/shared"],
  // Prefer this monorepo over a parent lockfile when tracing outputs.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async rewrites() {
    const apiUrl = (
      process.env.NEXT_PUBLIC_API_URL ??
      process.env.API_URL ??
      "http://localhost:4000"
    ).replace(/\/$/, "");
    return [
      { source: "/auth", destination: `${apiUrl}/auth` },
      { source: "/auth/:path*", destination: `${apiUrl}/auth/:path*` },
      { source: "/api/auth", destination: `${apiUrl}/auth` },
      { source: "/api/auth/:path*", destination: `${apiUrl}/auth/:path*` },
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;
