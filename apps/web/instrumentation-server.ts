import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === "development",

  // Performance monitoring
  enabled: process.env.NODE_ENV === "production" || !!process.env.SENTRY_DSN,

  // Capture server-side errors and API failures
  beforeSend(event, hint) {
    // Add environment context
    event.tags = {
      ...event.tags,
      environment: process.env.NODE_ENV,
      server_side: "true",
    };

    // Add custom context for API failures
    if (event.exception) {
      const error = hint.originalException;
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          if (error.message.includes("fetch")) {
            event.tags = {
              ...event.tags,
              error_type: "network_failure",
            };
          }
          if (error.message.includes("timeout")) {
            event.tags = {
              ...event.tags,
              error_type: "timeout",
            };
          }
        }
      }
    }

    return event;
  },

  // Capture slow server operations
  beforeSendTransaction(event) {
    if (event.spans) {
      event.spans.forEach(span => {
        // Flag slow database operations
        if (span.op === "db.query" || span.op === "db.connection") {
          if (span.timestamp && span.start_timestamp) {
            const duration = (span.timestamp - span.start_timestamp) * 1000;
            if (duration > 1000) { // 1 second
              if (!span.data) span.data = {};
              span.data.slow_operation = "true";
            }
          }
        }

        // Flag slow API calls
        if (span.op === "http.client") {
          if (span.timestamp && span.start_timestamp) {
            const duration = (span.timestamp - span.start_timestamp) * 1000;
            if (duration > 3000) { // 3 seconds
              if (!span.data) span.data = {};
              span.data.slow_api_call = "true";
            }
          }
        }
      });
    }

    return event;
  },
});
