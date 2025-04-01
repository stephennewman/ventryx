/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from 'firebase-functions/v2/https';
import app from './server/server.mjs';

console.log('Starting Firebase Function...');
console.log('Node.js Version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');

// Export the API using Functions v2
export const api = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  maxInstances: 10,
  minInstances: 0,
  concurrency: 80,
  timeoutSeconds: 60,
  cors: true,
  invoker: 'public'
}, app);
