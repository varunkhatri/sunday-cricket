/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};
export default nextConfig;
