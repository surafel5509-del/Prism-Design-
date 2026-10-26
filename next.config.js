/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  experimental: { serverComponentsExternalPackages: [] },
};
module.exports = nextConfig;
