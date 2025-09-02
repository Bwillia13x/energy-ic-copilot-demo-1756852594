/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // For demo/sampler, default to built-in mock API routes
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/demo',
    NEXT_PUBLIC_DEMO: process.env.NEXT_PUBLIC_DEMO || '1',
    NEXT_PUBLIC_REPO_URL: process.env.NEXT_PUBLIC_REPO_URL || 'https://github.com/'
  },
}

module.exports = nextConfig
