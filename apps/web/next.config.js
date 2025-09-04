// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

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
  images: {
    unoptimized: true,
  },
  // Environment variables resolved at build-time
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/demo',
    NEXT_PUBLIC_DEMO: process.env.NEXT_PUBLIC_DEMO || '1',
    NEXT_PUBLIC_REPO_URL: process.env.NEXT_PUBLIC_REPO_URL || 'https://github.com/'
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

module.exports = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Hides source maps and set various other Sentry CLI options
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/cron/jobs/

  // Note: Comment out or remove this line if you are not using Vercel Cron Monitors
  automaticVercelMonitors: true,
});
