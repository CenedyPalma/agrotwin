import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["agency.cenedypalma.com", "bayazid.cenedypalma.com"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.AGROTWIN_API_URL ?? "http://127.0.0.1:8000"}/api/:path*`,
      },
    ];
  },
  experimental: {
    // Drone frames are uploaded through this proxy in 20-file batches
    // (~10 MB per DJI JPG). Next buffers proxied bodies and silently truncates
    // them at 10 MB by default, which breaks multipart uploads.
    proxyClientMaxBodySize: "1gb",
    proxyTimeout: 600_000,
  },
};

export default nextConfig;
