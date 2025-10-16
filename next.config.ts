// next.config.js (Ensure this is exactly what you have)

import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // ... (rest of your config)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  experimental: {
    instrumentationHook: true, // This line is added
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },

  webpack: (config, { isServer }) => {
    // 1. Client-Side Fix: Stub out Node.js modules for the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false, 
        fs: false, 
        os: false,
        path: false,
      };
    }

    // 2. Server/Edge Fix: Use Webpack externals (as a backup)
    if (isServer) {
        config.externals = config.externals || [];
        config.externals.push('crypto', 'fs', 'os', 'path'); 
    }

    return config;
  }
};

export default nextConfig;
