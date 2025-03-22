const Sentry = require('@sentry/node');

Sentry.init({
  dsn: 'ventryx.netlify.app', // Replace with your actual DSN from Sentry
  tracesSampleRate: 1.0, // Adjust the sample rate for performance monitoring
});

// Example function to capture an error
function captureErrorExample() {
  try {
    // Simulate an error
    throw new Error('Test error for Sentry');
  } catch (error) {
    Sentry.captureException(error);
  }
}

captureErrorExample();