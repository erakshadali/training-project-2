import type { NextConfig } from "next";
import path from "node:path";

/** Basic browser protections. A full Content-Security-Policy is left out on purpose: Next.js inlines small scripts. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Lets a second local dev server run from its own folder (NEXT_DIST_DIR=.next-alt). Production uses the default.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Native/Node-only packages must not be bundled into the server build.
  serverExternalPackages: ["mongoose", "mongodb-memory-server", "bcryptjs"],
  turbopack: {
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
