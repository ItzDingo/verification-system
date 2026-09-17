/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['cdn.discordapp.com'],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Prevents stale chunk refs (e.g. "Cannot find module './638.js'") after HMR on Windows
      config.cache = { type: 'memory' };

      // Avoid Watchpack scanning protected Windows system paths (causes EINVAL + broken HMR)
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          'C:/System Volume Information/**',
          'C:/pagefile.sys',
          'C:/swapfile.sys',
          'C:/DumpStack.log.tmp',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;