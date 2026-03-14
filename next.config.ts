import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Required for container builds (Paketo, Docker)
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
