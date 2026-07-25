const apiOrigin = String(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    proxyClientMaxBodySize: '60mb',
  },

  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'via.placeholder.com',     pathname: '/**' },
    ],
  },
  async rewrites() {
    return [{ source: '/backend-api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

module.exports = nextConfig;
