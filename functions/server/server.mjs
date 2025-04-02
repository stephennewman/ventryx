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
import { getFunctions } from 'firebase-admin/functions';
import fs from 'fs';
import * as functions from 'firebase-functions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define parameters for Firebase Functions v2
export const plaidClientIdParam = defineString('PLAID_CLIENT_ID');
export const plaidSecretParam = defineString('PLAID_SECRET');
export const plaidEnvParam = defineString('PLAID_ENV', { default: 'sandbox' });
export const openaiApiKeyParam = defineString('OPENAI_API_KEY');

// Check if we're running in Firebase Functions
const isFirebaseFunctions = !!(process.env.FUNCTION_NAME || process.env.FIREBASE_CONFIG || process.env.GCLOUD_PROJECT);

// Set environment
process.env.NODE_ENV = isFirebaseFunctions ? 'production' : 'development';

// Only load local .env file if running in local development
if (process.env.LOCAL_DEV === 'true') {
  dotenv.config();
}

// Log environment info
console.log('Environment Info:', {
  nodeEnv: process.env.NODE_ENV,
  isFirebaseFunctions,
  hasFirebaseConfig: !!process.env.FIREBASE_CONFIG,
  isLocalDev: process.env.LOCAL_DEV === 'true'
});

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    // In production, use default credentials
    if (process.env.NODE_ENV === 'production') {
      admin.initializeApp();
      console.log('Firebase Admin initialized with default config');
    } else {
      // In development, use service account
      const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized with service account');
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

// Set up Firestore database reference
const db = getFirestore();

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

// Function to get configuration values
const getConfig = () => {
  let config = {};
  
  // In Firebase Functions environment, get values from functions config
  if (isFirebaseFunctions) {
    try {
      // Access config in Firebase Functions using the functions.config() method
      const runtimeConfig = functions.config();
      
      console.log('Runtime Config:', JSON.stringify(runtimeConfig, null, 2));
      
      // Check if runtimeConfig has plaid settings
      if (runtimeConfig && runtimeConfig.plaid) {
        config = {
          plaidClientId: runtimeConfig.plaid.client_id,
          plaidSecret: runtimeConfig.plaid.secret,
          plaidEnv: runtimeConfig.plaid.env || 'production',
          openaiApiKey: runtimeConfig.openai?.api_key || process.env.OPENAI_API_KEY
        };
        console.log('Using Firebase Runtime Config');
      } else {
        // Fallback to JSON.parse(process.env.FIREBASE_CONFIG)
        const functionsConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
        config = {
          plaidClientId: process.env.PLAID_CLIENT_ID,
          plaidSecret: process.env.PLAID_SECRET,
          plaidEnv: process.env.PLAID_ENV || 'production',
          openaiApiKey: process.env.OPENAI_API_KEY
        };
        console.log('Using environment variables from process.env');
      }
    } catch (error) {
      console.error('Error accessing Firebase config:', error);
      
      // Fallback to environment variables
      config = {
        plaidClientId: process.env.PLAID_CLIENT_ID,
        plaidSecret: process.env.PLAID_SECRET,
        plaidEnv: process.env.PLAID_ENV || 'production',
        openaiApiKey: process.env.OPENAI_API_KEY
      };
    }
  } else {
    // Local development - use .env file
    config = {
      plaidClientId: process.env.PLAID_CLIENT_ID,
      plaidSecret: process.env.PLAID_SECRET,
      plaidEnv: process.env.PLAID_ENV || 'production',
      openaiApiKey: process.env.OPENAI_API_KEY
    };
    console.log('Using local environment configuration');
  }

  // Log environment info (without sensitive values)
  console.log('Configuration:', {
    environment: process.env.NODE_ENV,
    plaidEnv: config.plaidEnv,
    hasPlaidConfig: !!config.plaidClientId && !!config.plaidSecret,
    hasOpenAIKey: !!config.openaiApiKey
  });

  return config;
};

// Initialize clients in request handlers to ensure parameters are available
app.use((req, res, next) => {
  const config = getConfig();
  
  // Debug the actual values (without revealing the full strings)
  const plaidClientIdMasked = config.plaidClientId ? 
    `${config.plaidClientId.substring(0, 4)}...${config.plaidClientId.substring(config.plaidClientId.length - 4)}` : 
    'NOT SET';
  const plaidSecretMasked = config.plaidSecret ? 
    `${config.plaidSecret.substring(0, 4)}...${config.plaidSecret.substring(config.plaidSecret.length - 4)}` : 
    'NOT SET';
  
  console.log('Debug - Masked credentials:', {
    plaidClientId: plaidClientIdMasked,
    plaidSecret: plaidSecretMasked,
    plaidEnv: config.plaidEnv
  });
  
  // Hardcode values for now (since config is not working correctly)
  const clientId = "67cc77c4a291e80023d19b3c";
  const secret = "52021cac3c02ac3ce0c00588b70cb9";
  
  console.log('Using hardcoded values for now:', {
    clientId: clientId ? 'SET' : 'NOT SET',
    secret: secret ? 'SET' : 'NOT SET',
    env: 'production'
  });
  
  // Plaid client setup with hardcoded values
  const configuration = new Configuration({
    basePath: PlaidEnvironments.production,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
        'Content-Type': 'application/json',
      },
    },
  });

  req.plaidClient = new PlaidApi(configuration);
  req.openai = new OpenAI({ apiKey: config.openaiApiKey });
  next();
});

// Plaid endpoints
app.post('/create-link-token', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  try {
    console.log('🔵 Creating link token for user:', userId);
    const createTokenConfig = {
      user: { client_user_id: userId },
      client_name: 'Ventryx',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    };

    // Enhanced debugging
    console.log('Debug - Plaid request config:', JSON.stringify(createTokenConfig, null, 2));
    
    // Check Plaid client configuration
    const headers = req.plaidClient.configuration.baseOptions.headers;
    console.log('Debug - Plaid API headers structure:', Object.keys(headers));
    
    // Show first and last few characters of credentials for debugging
    const maskString = (str) => str ? `${str.substring(0, 4)}...${str.substring(str.length - 4)}` : 'NOT SET';
    
    console.log('Debug - Plaid credentials format check:', {
      clientIdLength: headers['PLAID-CLIENT-ID'] ? headers['PLAID-CLIENT-ID'].length : 0,
      secretLength: headers['PLAID-SECRET'] ? headers['PLAID-SECRET'].length : 0,
      clientIdMasked: maskString(headers['PLAID-CLIENT-ID']),
      secretMasked: maskString(headers['PLAID-SECRET']),
      basePath: req.plaidClient.configuration.basePath
    });

    const createResponse = await req.plaidClient.linkTokenCreate(createTokenConfig);
    console.log('✅ Link token created successfully');
    res.json({ link_token: createResponse.data.link_token });
  } catch (error) {
    console.error("❌ Plaid linkTokenCreate failed:", {
      error: error.response?.data || error,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message
    });
    
    // Return a more helpful error response
    res.status(500).json({ 
      error: 'Failed to create link token', 
      details: error.response?.data?.error_message || error.message,
      code: error.response?.data?.error_code,
      status: 'Invalid Plaid Credentials',
      action: 'Please check your Plaid API credentials in the developer dashboard: https://dashboard.plaid.com/'
    });
  }
});

app.post('/exchange-token', async (req, res) => {
  const { publicToken, userId } = req.body;
  if (!publicToken || !userId) return res.status(400).json({ error: 'Public token and user ID are required' });

  try {
    console.log('🔵 Exchanging public token for user:', userId);
    const exchangeResponse = await req.plaidClient.itemPublicTokenExchange({
      public_token: publicToken
    });

    const accessToken = exchangeResponse.data.access_token;
    console.log('✅ Token exchanged successfully');

    try {
      const userRef = db.collection('users').doc(userId);
      await userRef.set({ plaidAccessToken: accessToken }, { merge: true });
      console.log('✅ Access token stored in Firestore');
    } catch (dbError) {
      console.warn('Failed to store access token in Firestore:', dbError);
    }

    res.json({
      success: true,
      access_token: accessToken
    });
  } catch (error) {
    console.error('❌ Plaid exchange-token error:', {
      error: error.response?.data || error,
      status: error.response?.status,
      statusText: error.response?.statusText,
      config: error.config
    });
    res.status(500).json({ 
      error: 'Failed to exchange token', 
      details: error.response?.data?.error_message || error.message,
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

    console.log('🔵 Fetching transactions for user:', userId);
    const today = new Date();
    const start_date = '2024-01-01';
    const end_date = today.toISOString().split('T')[0];
    
    const response = await req.plaidClient.transactionsGet({
      access_token,
      start_date,
      end_date,
      options: { count: 100, offset: 0 }
    });

    console.log('✅ Transactions fetched successfully');
    res.json({
      transactions: response.data.transactions,
      accounts: response.data.accounts
    });
  } catch (error) {
    console.error('❌ Plaid transactions error:', {
      error: error.response?.data || error,
      status: error.response?.status,
      statusText: error.response?.statusText,
      config: error.config
    });
    res.status(500).json({ 
      error: 'Failed to fetch transactions', 
      details: error.response?.data?.error_message || error.message,
      code: error.response?.data?.error_code
    });
  }
});

// OpenAI chat endpoints
app.post('/openai/chat', async (req, res) => {
  const { prompt } = req.body;
  try {
    const completion = await req.openai.chat.completions.create({
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
    const completion = await req.openai.chat.completions.create({
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

// Only export the Express app for Firebase Functions
export default app;