import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the Next.js dev HMR websocket to accept connections from
  // any host (needed when running inside Docker with a mapped port).
  allowedDevOrigins: ['localhost', '127.0.0.1'],

  // Enable filesystem polling for Docker bind-mounts (inotify may
  // not propagate reliably on all Docker/kernel combinations).
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

export default nextConfig;
