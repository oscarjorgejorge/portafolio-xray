const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Optimize compilation performance
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Optimize webpack for faster compilation
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Optimize file watching for faster HMR
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: [
          '**/node_modules',
          '**/.git',
          '**/.next',
          '**/dist',
          '**/build',
          '**/.turbo',
          '**/coverage',
          '**/.cache',
        ],
      };

      // Reduce memory usage and speed up compilation during development
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
        // Disable minification in dev for faster builds
        minimize: false,
        // Faster module resolution
        moduleIds: 'named',
        chunkIds: 'named',
      };

      // Faster source maps in development
      config.devtool = 'eval-cheap-module-source-map';

      // Cache modules for faster rebuilds
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
        cacheDirectory: '.next/cache/webpack',
      };
    }

    // Exclude unnecessary modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }

    // Optimize module resolution
    config.resolve.modules = ['node_modules', ...(config.resolve.modules || [])];

    // Faster module resolution
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.jsx': ['.jsx', '.tsx'],
    };

    return config;
  },

  // Optimize TypeScript compilation
  typescript: {
    // Type checking happens separately, don't block compilation
    // In dev, Next.js runs type checking in parallel - this only affects builds
    ignoreBuildErrors: false,
  },

  // ESLint is configured separately, not in next.config.js (Next.js 16+)

  // Optimize images (if you use next/image)
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Enable experimental features for better performance
  experimental: {
    // Optimize package imports
    optimizePackageImports: ['@tanstack/react-query'],
    // Faster server components
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Turbopack configuration (Next.js 16+ uses Turbopack by default)
  // Empty config to silence warning - webpack config is for fallback only
  turbopack: {},

  // i18n is now handled by next-intl via the [locale] folder structure
};

module.exports = withNextIntl(nextConfig);

