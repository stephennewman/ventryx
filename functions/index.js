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
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const functions = require('firebase-functions');
const axios = require('axios');
const { OpenAI } = require('openai');

// Initialize Firebase Admin
initializeApp();

// Initialize Firestore
const db = getFirestore();

const app = express();

// Enable CORS with more permissive options
app.use(cors({
  origin: ["https://get.krezzo.com", "http://localhost:5173", "http://localhost:5176"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  credentials: true,
  maxAge: 86400,
}));

// Add CORS headers middleware
app.use((req, res, next) => {
  const allowedOrigins = ["https://get.krezzo.com", "http://localhost:5173", "http://localhost:5176"];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin",
  );
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

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
  basePath: PlaidEnvironments["sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": "67cc77c4a291e80023d19b3c",
      "PLAID-SECRET": "6b44b731a9bc537a36befba5fcbe77",
      "Content-Type": "application/json",
    },
  },
});

// Add debug logging
console.log("Plaid configuration:", {
  clientId: configuration.baseOptions.headers["PLAID-CLIENT-ID"],
  secret: configuration.baseOptions.headers["PLAID-SECRET"],
  environment: "sandbox",
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
      const userId = req.body.user_id;
      if (!userId) {
        console.error("No user_id provided in request body");
        return res.status(400).json({error: "No user_id provided"});
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
      res.json({link_token: response.data.link_token});
    } catch (err) {
      console.error("Error creating link token:", err);
      res.status(500).json({
        error: err.message,
        details: err.response ? err.response.data : {},
      });
    }
  } else if (action === "exchange-token") {
    console.log("Received exchange-token request");
    console.log("Request body:", req.body);
    const {publicToken, userId} = req.body;
    console.log("Public token:", publicToken);
    console.log("User ID:", userId);

    if (!publicToken || !userId) {
      console.error("Missing required fields");
      return res.status(400).json({
        error: "Missing required fields",
        details: !publicToken ?
          "No public token provided" :
          "No user ID provided",
      });
    }

    try {
      console.log("Exchanging public token for access token...");
      const response = await client.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const accessToken = response.data.access_token;
      const itemId = response.data.item_id;

      // Store the access token in Firestore
      await db.collection("plaid_items").doc(userId).set({
        access_token: accessToken,
        item_id: itemId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      console.log("Successfully exchanged token and stored in Firestore");
      res.json({success: true});
    } catch (err) {
      console.error("Error exchanging token:", err);
      res.status(500).json({
        error: err.message,
        details: err.response ? err.response.data : {},
      });
    }
  } else if (action === "transactions") {
    try {
      const {userId} = req.body;
      if (!userId) {
        console.error("No userId provided in request body");
        return res.status(400).json({error: "No userId provided"});
      }

      console.log("Fetching access token from Firestore for user:", userId);
      const plaidItemDoc = await db.collection("plaid_items").doc(userId).get();
      if (!plaidItemDoc.exists) {
        console.error("No Plaid item found for user:", userId);
        return res.status(404).json({error: "No linked bank account found"});
      }

      const accessToken = plaidItemDoc.data().access_token;
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
        details: err.response ? err.response.data : {},
      });
    }
  } else {
    console.error("Invalid action:", action);
    res.status(404).json({error: "Invalid action"});
  }
});

// OpenAI chat endpoints
app.post('/api/openai/chat', async (req, res) => {
  const { prompt } = req.body;
  try {
    const openai = new OpenAI({ apiKey: functions.config().openai.key });
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4"
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error('OpenAI error:', error);
    res.status(500).json({ error: 'Failed to fetch response from OpenAI', details: error.message });
  }
});

app.post('/api/openai/chat-with-transactions', async (req, res) => {
  const { messages, transactions } = req.body;

  // Validate input
  if (!Array.isArray(messages) || !Array.isArray(transactions)) {
    return res.status(400).json({
      error: 'messages and transactions are required and must be arrays',
    });
  }

  try {
    const openai = new OpenAI({ apiKey: functions.config().openai.key });
    
    // System prompt for the AI assistant
    const systemPrompt = `
You are a helpful financial assistant. You have access to a user's transaction history and help answer questions, analyze spending, and forecast budgets.

Respond in markdown. Be concise but informative. Use bullet points or tables when helpful.

Current date is ${new Date().toLocaleDateString()}. 

Capabilities:
- Calculate totals, averages, frequencies
- Identify spending by date, merchant, category
- Offer budgeting or saving tips
- Forecast likely monthly spending based on existing patterns

Only reference the data if the prompt relates to transactions or spending.
If the user's message is conversational or general, respond appropriately without referencing their data.
    `.trim();

    // Format transaction data for context
    const formattedTransactions = transactions.map(txn => ({
      date: txn.date,
      name: txn.name,
      amount: txn.amount,
      category: txn.category?.[0] || 'Uncategorized',
    }));
    const dataString = JSON.stringify(formattedTransactions, null, 2);

    // Last message from the user
    const lastUserMessage = messages.slice().reverse().find(msg => msg.role === 'user')?.content || '';

    // Check if the message is related to spending
    const financialKeywords = /spend|purchase|cost|transaction|budget|buy|bought|amount|paid|expense|Uber|Starbucks|total/i;
    const shouldInjectData = financialKeywords.test(lastUserMessage);

    // Compose final messages
    const finalMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    if (shouldInjectData) {
      finalMessages.push({
        role: 'user',
        content: `Here are the user's transactions:\n${dataString}`,
      });
    }

    // Send to OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: finalMessages,
      temperature: 0.7,
    });

    res.json({ message: completion.choices[0].message.content });
  } catch (error) {
    console.error('🧠 OpenAI chat error:', error);
    res.status(500).json({
      error: 'Failed to generate a response',
      details: error.message,
    });
  }
});

exports.api = onRequest(
    {
      memory: "256MiB",
      region: "us-central1",
      invoker: "public",
      cors: {
        origin: ["https://get.krezzo.com", "http://localhost:5173", "http://localhost:5176"],
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
