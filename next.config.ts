import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/sdk", "groq-sdk", "@elevenlabs/elevenlabs-js"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  webpack: (config) => {
    // Required for @ricky0123/vad-react (ONNX runtime)
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
};

export default nextConfig;
