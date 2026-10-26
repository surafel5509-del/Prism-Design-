/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  experimental: {
    serverComponentsExternalPackages: ['@ai-sdk/openai', '@ai-sdk/anthropic', '@ai-sdk/google', '@ai-sdk/deepseek', '@ai-sdk/openai-compatible'],
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};
export default nextConfig;
