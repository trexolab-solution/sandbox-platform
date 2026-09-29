import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["sandbox.trexolab.com"],
  experimental: {
    // Increase body size limit for file uploads
    // Supports up to 300MB to accommodate max upload size (50MB * 5 = 250MB)
    // NOTE: Use uppercase "MB" - lowercase "mb" is ignored by Next.js
    serverActions: {
      bodySizeLimit: "300MB",
    },
    proxyClientMaxBodySize: "300MB",
  },
  // Exclude native modules from Edge bundling
  // These are only used in Node.js runtime via instrumentation.ts
  serverExternalPackages: [
    "dockerode",
    "docker-modem",
    "ssh2",
    "cpu-features",
    "better-sqlite3",
  ],
};

export default nextConfig;
