import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === "development",

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Performance monitoring
  enabled: process.env.NODE_ENV === "production" || !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture console errors and warnings
  beforeSend(event, hint) {
    // Filter out development errors
    if (process.env.NODE_ENV === "development") {
      console.log("Sentry event:", event);
    }

    // Add custom context for API failures
    if (event.exception) {
      const error = hint.originalException;
      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes("HTTP")) {
        event.tags = {
          ...event.tags,
          error_type: "api_failure",
        };
      }
    }

    return event;
  },

  // Capture slow queries and performance issues
  beforeSendTransaction(event) {
    // Add custom tags for performance monitoring
    if (event.spans) {
      event.spans.forEach(span => {
        if (span.op === "http.client" && span.description?.includes("api/")) {
          if (!span.data) span.data = {};
          span.data.api_call = "true";

          // Flag slow API calls
          if (span.timestamp && span.start_timestamp) {
            const duration = (span.timestamp - span.start_timestamp) * 1000;
            if (duration > 5000) { // 5 seconds
              if (!span.data) span.data = {};
              span.data.slow_query = "true";
            }
          }
        }
      });
    }

    return event;
  },
});

// Export the router transition hook
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
