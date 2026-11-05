import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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
