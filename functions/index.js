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

// Enable CORS with more permissive options
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  credentials: true,
  maxAge: 86400,
}));

app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    query: req.query,
    body: req.body,
    headers: req.headers,
  });
  next();
});

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

app.get("/api", (req, res) => {
  res.json({status: "ok"});
});

app.post("/api", async (req, res) => {
  const path = req.path || "/";
  const action = req.body.action;

  console.log("Received request:", {
    path,
    action,
    body: req.body,
    headers: req.headers,
  });

  if (!action) {
    console.error("No action specified in request");
    return res.status(400).json({error: "No action specified"});
  }

  if (action === "create-link-token") {
    try {
      const {userId} = req.body;
      if (!userId) {
        console.error("No userId provided in request body");
        return res.status(400).json({error: "No userId provided"});
      }

      console.log("Creating link token for user:", userId);

      const request = {
        user: {client_user_id: userId},
        client_name: "Ventryx",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
      };

      console.log("Link token request:", request);

      const response = await client.linkTokenCreate(request);
      console.log("Link token created successfully:", response.data);
      res.json({linkToken: response.data.link_token});
    } catch (err) {
      console.error("Error creating link token:", err);
      res.status(500).json({
        error: err.message,
        details: err.response?.data || {},
      });
    }
  } else if (action === "exchange-token") {
    try {
      const {publicToken} = req.body;
      if (!publicToken) {
        console.error("No publicToken provided in request body");
        return res.status(400).json({error: "No publicToken provided"});
      }

      console.log("Exchanging public token");

      const response = await client.itemPublicTokenExchange({
        public_token: publicToken,
      });

      console.log("Successfully exchanged token");
      res.json({accessToken: response.data.access_token});
    } catch (err) {
      console.error("Error exchanging token:", err);
      res.status(500).json({
        error: err.message,
        details: err.response?.data || {},
      });
    }
  } else if (action === "transactions") {
    try {
      const {accessToken} = req.body;
      if (!accessToken) {
        console.error("No accessToken provided in request body");
        return res.status(400).json({error: "No accessToken provided"});
      }

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
      res.status(500).json({
        error: err.message,
        details: err.response?.data || {},
      });
    }
  } else {
    console.error("Invalid action:", action);
    res.status(404).json({error: "Invalid action"});
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
