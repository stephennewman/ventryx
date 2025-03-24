/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const app = require("../server/server");

exports.api = onRequest(
    {
      memory: "256MiB",
      region: "us-central1",
      invoker: "public",
      cors: {
        origin: ["https://get.krezzo.com", "https://api.get.krezzo.com", "http://localhost:5173", "http://localhost:5176"],
        methods: ["GET", "POST", "OPTIONS"],
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Requested-With",
          "Accept",
          "Origin",
        ],
        maxAge: 86400,
      },
    },
    app,
);
