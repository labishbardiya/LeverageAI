import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/architecture",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
