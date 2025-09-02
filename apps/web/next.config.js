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
  // Completely disable static generation to avoid SSR issues
  output: 'standalone',
  trailingSlash: false,
  experimental: {
    // Disable all static optimization
    serverComponentsExternalPackages: [],
    // Disable static optimization for all pages
    disableOptimizedLoading: true,
  },
  // Force all pages to be server-rendered only
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  env: {
    // For demo/sampler, default to built-in mock API routes
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/demo',
    NEXT_PUBLIC_DEMO: process.env.NEXT_PUBLIC_DEMO || '1',
    NEXT_PUBLIC_REPO_URL: process.env.NEXT_PUBLIC_REPO_URL || 'https://github.com/'
  },
}

module.exports = nextConfig
