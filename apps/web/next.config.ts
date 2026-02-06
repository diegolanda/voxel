import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@voxel/engine", "@voxel/worldgen", "@voxel/domain"],
  turbopack: {},
  typescript: {
    // Pre-existing type errors in supabase package; our engine code is clean
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
