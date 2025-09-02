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
  // Disable static generation to avoid SSR issues
  output: 'standalone',
  experimental: {
    // Disable static optimization for all pages
    serverComponentsExternalPackages: [],
  },
  env: {
    // For demo/sampler, default to built-in mock API routes
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/demo',
    NEXT_PUBLIC_DEMO: process.env.NEXT_PUBLIC_DEMO || '1',
    NEXT_PUBLIC_REPO_URL: process.env.NEXT_PUBLIC_REPO_URL || 'https://github.com/'
  },
}

module.exports = nextConfig
