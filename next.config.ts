import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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
