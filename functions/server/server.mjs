import express from 'express';
import cors from 'cors';
import path from 'path';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { OpenAI } from 'openai';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { defineString } from 'firebase-functions/params';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if we're running in Firebase Functions
const isFirebaseFunctions = !!(process.env.FUNCTION_NAME || process.env.FIREBASE_CONFIG || process.env.GCLOUD_PROJECT);

// Initialize environment variables in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp();
    console.log('Firebase Admin initialized with default config');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

// Set up Firestore database reference
const db = getFirestore();

// Define configuration parameters
const plaidClientId = defineString('PLAID_CLIENT_ID');
const plaidSecret = defineString('PLAID_SECRET');
const plaidEnv = defineString('PLAID_ENV', { default: 'sandbox' });
const openaiApiKey = defineString('OPENAI_API_KEY');

// Create the Express app instance
const app = express();

// Configure CORS with specific origins
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://ventryx.com',
    'https://www.ventryx.com',
    'https://ventryx.netlify.app'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoints
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Plaid client setup
const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': plaidClientId,
      'PLAID-SECRET': plaidSecret,
      'Content-Type': 'application/json',
    },
  },
});

// Log Plaid configuration (without sensitive data)
console.log('Plaid Configuration:', {
  environment: plaidEnv,
  hasClientId: !!plaidClientId,
  hasSecret: !!plaidSecret
});

const plaidClient = new PlaidApi(configuration);

// OpenAI setup
const openai = new OpenAI({ apiKey: openaiApiKey });

// Plaid endpoints
app.post('/create-link-token', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  try {
    console.log('🔵 Creating link token for user:', userId);
    const config = {
      user: { client_user_id: userId },
      client_name: 'Ventryx',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    };

    const createResponse = await plaidClient.linkTokenCreate(config);
    console.log('✅ Link token created successfully');
    res.json({ link_token: createResponse.data.link_token });
  } catch (error) {
    console.error("❌ Plaid linkTokenCreate failed:", {
      error: error.response?.data || error,
      status: error.response?.status,
      statusText: error.response?.statusText,
      config: error.config
    });
    res.status(500).json({ 
      error: 'Failed to create link token', 
      details: error.response?.data?.error_message || error.message,
      code: error.response?.data?.error_code
    });
  }
});

app.post('/exchange-token', async (req, res) => {
  const { publicToken, userId } = req.body;
  if (!publicToken || !userId) return res.status(400).json({ error: 'Public token and user ID are required' });

  try {
    const response = await fetch(`https://${plaidEnv}.plaid.com/item/public_token/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaidClientId,
        'PLAID-SECRET': plaidSecret,
      },
      body: JSON.stringify({ public_token: publicToken })
    });

    const data = await response.json();

    try {
      const userRef = db.collection('users').doc(userId);
      await userRef.set({ plaidAccessToken: data.access_token }, { merge: true });
    } catch (dbError) {
      console.warn('Failed to store access token in Firestore:', dbError);
    }

    res.json({
      success: true,
      access_token: data.access_token
    });
  } catch (error) {
    console.error('Plaid exchange-token error:', error);
    res.status(500).json({ 
      error: 'Failed to exchange token', 
      details: error.message,
      code: error.response?.data?.error_code
    });
  }
});

app.post('/transactions', async (req, res) => {
  try {
    const { userId, accessToken } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    let access_token = accessToken;

    if (!access_token && process.env.NODE_ENV === 'production') {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        access_token = userDoc.data()?.plaidAccessToken;
      } catch (dbError) {
        console.error('Failed to get access token from Firestore:', dbError);
      }
    }
    
    if (!access_token) {
      return res.json({ transactions: [], accounts: [] });
    }

    const today = new Date();
    const start_date = '2024-01-01';
    const end_date = today.toISOString().split('T')[0];
    
    const response = await fetch(`https://${plaidEnv}.plaid.com/transactions/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaidClientId,
        'PLAID-SECRET': plaidSecret,
      },
      body: JSON.stringify({
        access_token,
        start_date,
        end_date,
        options: { count: 100, offset: 0 }
      })
    });
    
    const data = await response.json();
    res.json({
      transactions: data.transactions,
      accounts: data.accounts
    });
  } catch (error) {
    console.error('Plaid transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
  }
});

// OpenAI chat endpoints
app.post('/openai/chat', async (req, res) => {
  const { prompt } = req.body;
  try {
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

app.post('/openai/chat-with-transactions', async (req, res) => {
  const { messages, transactions } = req.body;
  if (!Array.isArray(messages) || !Array.isArray(transactions)) {
    return res.status(400).json({ error: 'messages and transactions are required and must be arrays' });
  }
  try {
    const systemPrompt = `
You are a helpful financial assistant. You have access to a user's transaction history and help answer questions, analyze spending, and forecast budgets.

Respond in markdown. Be concise but informative. Use bullet points or tables when helpful.

Current date is March 22, 2025. The transaction data starts from January 1, 2025.

Capabilities:
- Calculate totals, averages, frequencies
- Identify spending by date, merchant, category
- Offer budgeting or saving tips
- Forecast likely monthly spending based on existing patterns

Only reference the data if the prompt relates to transactions or spending.
If the user's message is conversational or general, respond appropriately without referencing their data.
    `.trim();

    const formattedTransactions = transactions.map(txn => ({
      date: txn.date,
      name: txn.name,
      amount: txn.amount,
      category: txn.category?.[0] || 'Uncategorized'
    }));
    const dataString = JSON.stringify(formattedTransactions, null, 2);
    const lastUserMessage = messages.slice().reverse().find(msg => msg.role === 'user')?.content || '';
    const financialKeywords = /spend|purchase|cost|transaction|budget|buy|bought|amount|paid|expense|Uber|Starbucks|total/i;
    const shouldInjectData = financialKeywords.test(lastUserMessage);
    const finalMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    if (shouldInjectData) {
      finalMessages.push({ role: 'user', content: `Here are the user's transactions:\n${dataString}` });
    }
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: finalMessages,
      temperature: 0.7
    });
    res.json({ message: completion.choices[0].message.content });
  } catch (error) {
    console.error('OpenAI chat error:', error);
    res.status(500).json({ error: 'Failed to generate a response', details: error.message });
  }
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Only start the server if running locally
if (process.env.LOCAL_DEV === 'true') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Listening locally on port ${port}`);
  });
}

// Export the Express app for Firebase Functions
export default app;