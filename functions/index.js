/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require("firebase-functions/v2/https");
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

console.log('Starting Firebase Function...');

const serverApp = require('./server/server');

exports.api = onRequest(
  {
    memory: "256MiB",
    region: "us-central1",
    invoker: "public",
    cors: {
      origin: [
        "https://ventryx.netlify.app",
        "https://ventryx.com",
        "https://www.ventryx.com",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5176"
      ],
      methods: ["GET", "POST", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "PLAID-CLIENT-ID",
        "PLAID-SECRET"
      ],
      maxAge: 86400,
      credentials: true
    },
  },
  serverApp
);
