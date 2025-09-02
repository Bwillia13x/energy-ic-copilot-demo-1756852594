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
  // Standalone output for Vercel deployment
  output: 'standalone',
  trailingSlash: false,
  // Disable static optimization to avoid SSR context issues
  experimental: {
    disableOptimizedLoading: true,
  },
  env: {
    // For demo/sampler, default to built-in mock API routes
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/demo',
    NEXT_PUBLIC_DEMO: process.env.NEXT_PUBLIC_DEMO || '1',
    NEXT_PUBLIC_REPO_URL: process.env.NEXT_PUBLIC_REPO_URL || 'https://github.com/'
  },
}

module.exports = nextConfig
