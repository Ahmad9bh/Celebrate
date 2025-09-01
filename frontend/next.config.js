/******** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'http', hostname: 'localhost' }] },
  eslint: { ignoreDuringBuilds: true },
};
module.exports = nextConfig;
