/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during build for deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript error checks during build for deployment
    ignoreBuildErrors: true,
  },
  trailingSlash: false,
  // Stable configuration to prevent server restarts
  experimental: {
    disableOptimizedLoading: true,
  },
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  // Static environment variables - no process.env usage to prevent restarts
  env: {
    NEXT_PUBLIC_API_URL: '/api/demo',
    NEXT_PUBLIC_DEMO: '1',
    NEXT_PUBLIC_REPO_URL: 'https://github.com/'
  },
  // Disable file watching for config changes
  webpack: (config, { dev }) => {
    if (!dev) {
      return config
    }
    // Prevent webpack from watching next.config.js changes
    config.watchOptions = {
      ...config.watchOptions,
      ignored: /next\.config\.js$/,
    }
    return config
  },
}

module.exports = nextConfig
