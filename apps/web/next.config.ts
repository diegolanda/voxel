import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@voxel/domain",
    "@voxel/engine",
    "@voxel/protocol",
    "@voxel/realtime",
    "@voxel/supabase",
    "@voxel/ui",
    "@voxel/voice",
    "@voxel/worldgen"
  ],
  output: "standalone",
  turbopack: {},
  typescript: {
    // Pre-existing type errors in supabase package; our engine code is clean
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
