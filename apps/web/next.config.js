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

  // Optimize ESLint
  eslint: {
    // ESLint runs separately in dev mode, this only affects builds
    ignoreDuringBuilds: false,
  },

  // Optimize images (if you use next/image)
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Enable experimental features for better performance
  experimental: {
    // Optimize package imports
    optimizePackageImports: ['@tanstack/react-query', 'axios'],
    // Faster server components
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Enable i18n routing if needed (currently using [locale] folder structure)
  // i18n: {
  //   locales: ['en', 'es'],
  //   defaultLocale: 'en',
  // },
};

module.exports = nextConfig;

