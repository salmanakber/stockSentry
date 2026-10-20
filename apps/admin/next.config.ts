import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath: "/admin",
  trailingSlash: false,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async rewrites() {
    const apiUrl = (
      process.env.NEXT_PUBLIC_API_URL ??
      process.env.API_URL ??
      "http://localhost:4000"
    ).replace(/\/$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
