/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const {Configuration, PlaidApi, PlaidEnvironments} = require("plaid");

const app = express();

// Enable CORS with default options first
app.use(cors());

// Then add specific headers for all responses
app.use((req, res, next) => {
  res.set({
    "Access-Control-Allow-Origin": "https://ventryx.netlify.app",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, PATCH, DELETE",
    "Access-Control-Allow-Headers":
      "X-Requested-With, Content-Type, Authorization, " +
      "PLAID-CLIENT-ID, PLAID-SECRET",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  });

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.use(express.json());

const configuration = new Configuration({
  basePath: PlaidEnvironments[
      process.env.PLAID_ENV || "sandbox"
  ],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const client = new PlaidApi(configuration);

app.get("/health", (req, res) => {
  res.json({status: "ok"});
});

app.post("/create-link-token", async (req, res) => {
  try {
    const {userId} = req.body;
    console.log("Creating link token for user:", userId);

    const request = {
      user: {clientUserId: userId},
      clientName: "Ventryx",
      products: ["transactions"],
      countryCodes: ["US"],
      language: "en",
    };

    const response = await client.linkTokenCreate(request);
    console.log("Link token created successfully");
    res.json({linkToken: response.data.link_token});
  } catch (err) {
    console.error("Error creating link token:", err);
    res.status(500).json({error: err.message});
  }
});

app.post("/exchange-token", async (req, res) => {
  try {
    const {publicToken} = req.body;
    console.log("Exchanging public token");

    const response = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });

    console.log("Successfully exchanged token");
    res.json({accessToken: response.data.access_token});
  } catch (err) {
    console.error("Error exchanging token:", err);
    res.status(500).json({error: err.message});
  }
});

app.post("/transactions", async (req, res) => {
  try {
    const {accessToken} = req.body;
    console.log("Fetching transactions");

    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const response = await client.transactionsGet({
      access_token: accessToken,
      start_date: oneYearAgo.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
    });

    const accountsResponse = await client.accountsGet({
      access_token: accessToken,
    });

    console.log("Successfully fetched transactions");
    res.json({
      transactions: response.data.transactions,
      accounts: accountsResponse.data.accounts,
    });
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({error: err.message});
  }
});

exports.api = onRequest(
    {
      memory: "256MiB",
      region: "us-central1",
      invoker: "public",
      cors: {
        origin: true,
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
