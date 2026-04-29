import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/user-api", destination: "/settings/api", permanent: false },
      { source: "/userapi", destination: "/settings/api", permanent: false },
    ];
  },
};

export default nextConfig;
