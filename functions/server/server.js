const express = require('express');
const cors = require('cors');
const path = require('path');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const { OpenAI } = require('openai');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const functions = require('firebase-functions');

// Improved environment variable loading
if (!process.env.FUNCTION_TARGET) {  // Skip if running as a Firebase function
  // Set default NODE_ENV if not set
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  
  // Select the correct .env file based on environment
  const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
  
  // Simple path resolution directly to the root directory (two levels up from functions/server)
  const envPath = path.resolve(__dirname, '../../', envFile);
  
  console.log(`Loading environment from: ${envPath}`);
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.warn(`Failed to load ${envFile}: ${result.error.message}`);
    // Try .env as fallback
    const fallbackPath = path.resolve(__dirname, '../../.env');
    console.log(`Trying fallback .env at: ${fallbackPath}`);
    dotenv.config({ path: fallbackPath });
  } else {
    console.log('Environment variables loaded successfully');
  }
  
  // Add debug logging for important environment variables
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    VITE_API_URL: process.env.VITE_API_URL,
    PORT: process.env.PORT,
    hasPlaidClientId: !!process.env.PLAID_CLIENT_ID,
    hasPlaidSecret: !!process.env.PLAID_SECRET,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY
  });
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    if (process.env.NODE_ENV === 'production') {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    } else {
      // For local development and testing
      try {
        // Try different paths for the service account file
        let serviceAccount;
        const possiblePaths = [
          path.resolve(__dirname, '..', '..', 'firebase-service-account.json'),
          path.resolve(__dirname, '..', 'firebase-service-account.json'),
          path.resolve(__dirname, 'firebase-service-account.json')
        ];

        for (const filePath of possiblePaths) {
          try {
            serviceAccount = require(filePath);
            console.log(`Loaded service account from: ${filePath}`);
            break;
          } catch (e) {
            console.log(`Could not load service account from: ${filePath}`);
          }
        }

        if (serviceAccount) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
        } else {
          throw new Error('Service account file not found');
        }
      } catch (e) {
        console.warn('Firebase service account file not found. Some features will be disabled.');
        admin.initializeApp({
          // Use a dummy config for local dev if no service account is present
          projectId: 'dummy-project',
          credential: admin.credential.applicationDefault()
        });
      }
    }
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    // Don't throw - let the app continue without Firebase
  }
}

// Create the Express app instance
const app = express();

// Only add the rewriting middleware if not running as a Firebase function
if (!process.env.FUNCTION_TARGET) {
  app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.path.startsWith('/api/')) {
      req.url = `/api${req.url}`;
    }
    next();
  });
}

// Set up Firestore database reference
const db = admin.firestore();

// Configure CORS and JSON parsing
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://ventryx.netlify.app',
    'https://ventryx.com',
    'https://www.ventryx.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'PLAID-CLIENT-ID', 'PLAID-SECRET']
}));
app.use(express.json());

// Verify environment variables
console.log('Plaid Client ID:', process.env.PLAID_CLIENT_ID ? 'Present' : 'Missing');
console.log('Plaid Secret:', process.env.PLAID_SECRET ? 'Present' : 'Missing');
console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');

// Get environment variables for credentials, prioritizing Firebase environment variables
// Determine the correct source for credentials
let plaidClientId, plaidSecret, openaiApiKey;

if (process.env.FUNCTION_TARGET) {
  // Running in Firebase Functions environment
  try {
    plaidClientId = functions.config().plaid?.client_id;
    plaidSecret = functions.config().plaid?.secret;
    openaiApiKey = functions.config().openai?.api_key;
    console.log('Using Plaid credentials from Firebase Functions config');
  } catch (err) {
    console.error('Error loading Firebase functions config:', err);
  }
} else {
  // Local development
  plaidClientId = process.env.PLAID_CLIENT_ID;
  plaidSecret = process.env.PLAID_SECRET;
  openaiApiKey = process.env.OPENAI_API_KEY;
  console.log('Using Plaid credentials from environment variables');
}

// Verify we have the required credentials
if (!plaidClientId || !plaidSecret) {
  console.error('[CRITICAL] Missing Plaid credentials - Plaid functionality will not work properly');
}

// Determine environment for Plaid API
const plaidEnv = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
const plaidBaseUrl = `https://${plaidEnv}.plaid.com`;

// Plaid client setup with environment-specific configuration
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

// Log the actual headers being sent to Plaid
console.log('Plaid API Headers:', {
  'PLAID-CLIENT-ID': plaidClientId ? plaidClientId.substring(0, 5) + '...' : 'Not Set',
  'PLAID-SECRET': plaidSecret ? plaidSecret.substring(0, 5) + '...' : 'Not Set',
  'environment': plaidEnv,
  'basePath': PlaidEnvironments[plaidEnv]
});

const plaidClient = new PlaidApi(configuration);

// OpenAI setup
const openai = new OpenAI({ apiKey: openaiApiKey });

// Health check endpoints (both with and without /api prefix)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Plaid endpoints (both with and without /api prefix)
app.post('/create-link-token', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  try {
    const config = {
      user: { client_user_id: userId },
      client_name: 'Ventryx',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    };

    if (process.env.NODE_ENV === 'test') {
      return res.json({ link_token: 'test-link-token' });
    }

    // Use fetch instead of the Plaid SDK
    const response = await fetch(`${plaidBaseUrl}/link/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaidClientId,
        'PLAID-SECRET': plaidSecret,
      },
      body: JSON.stringify(config)
    });
    
    const data = await response.json();
    res.json({ link_token: data.link_token });
  } catch (error) {
    console.error('Plaid create-link-token error:', error);
    res.status(500).json({ error: 'Failed to create link token', details: error.message });
  }
});
app.post('/api/create-link-token', async (req, res) => {
  // Same as above endpoint duplication for /api prefix
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  try {
    const config = {
      user: { client_user_id: userId },
      client_name: 'Ventryx',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    };

    if (process.env.NODE_ENV === 'test') {
      return res.json({ link_token: 'test-link-token' });
    }

    // Use fetch instead of the Plaid SDK
    const response = await fetch(`${plaidBaseUrl}/link/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaidClientId,
        'PLAID-SECRET': plaidSecret,
      },
      body: JSON.stringify(config)
    });
    
    const data = await response.json();
    res.json({ link_token: data.link_token });
  } catch (error) {
    console.error('Plaid create-link-token error:', error);
    res.status(500).json({ error: 'Failed to create link token', details: error.message });
  }
});

app.post('/exchange-token', async (req, res) => {
  const { publicToken, userId } = req.body;
  if (!publicToken || !userId) return res.status(400).json({ error: 'Public token and user ID are required' });

  console.log('Exchanging public token for access token...');
  try {
    const response = await fetch(`${plaidBaseUrl}/item/public_token/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaidClientId,
        'PLAID-SECRET': plaidSecret,
      },
      body: JSON.stringify({ public_token: publicToken })
    });

    const data = await response.json();
    console.log('Plaid exchange response:', data); // helpful for debugging

    // Store the access token in Firestore
    try {
      const userRef = db.collection('users').doc(userId);
      await userRef.set({ plaidAccessToken: data.access_token }, { merge: true });
    } catch (dbError) {
      console.warn('Failed to store access token in Firestore:', dbError);
    }

    // ✅ Always return the access_token
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

app.post('/api/exchange-token', async (req, res) => {
  // Duplicate of /exchange-token endpoint for /api prefix
  const { publicToken, userId } = req.body;
  if (!publicToken || !userId) return res.status(400).json({ error: 'Public token and user ID are required' });

  console.log('Exchanging public token for access token...');
  try {
    const response = await fetch(`${plaidBaseUrl}/item/public_token/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaidClientId,
        'PLAID-SECRET': plaidSecret,
      },
      body: JSON.stringify({ public_token: publicToken })
    });

    const data = await response.json();
    console.log('Plaid exchange response:', data);

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
    console.log('Transactions request received:', { userId, hasAccessToken: !!accessToken, requestBody: req.body });
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    let access_token = accessToken;
    console.log('Initial access token:', !!access_token, typeof access_token);

    if (!access_token && process.env.NODE_ENV === 'production') {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        access_token = userDoc.data()?.plaidAccessToken;
        console.log('Got access token from Firestore:', !!access_token);
      } catch (dbError) {
        console.error('Failed to get access token from Firestore:', dbError);
      }
    }
    if (!access_token) {
      console.log('No access token available, returning empty data');
      return res.json({ transactions: [], accounts: [] });
    }

    console.log('Fetching transactions with access token...');
    // Use fetch instead of Plaid SDK
    const today = new Date();
    const start_date = '2024-01-01';
    const end_date = today.toISOString().split('T')[0];
    
    const response = await fetch(`${plaidBaseUrl}/transactions/get`, {
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
    console.log('Got transactions response:', {
      numTransactions: data.transactions?.length,
      numAccounts: data.accounts?.length,
      firstTransaction: data.transactions?.[0]
    });
    
    res.json({
      transactions: data.transactions,
      accounts: data.accounts
    });
  } catch (error) {
    console.error('Plaid transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
  }
});
app.post('/api/transactions', async (req, res) => {
  // Duplicate of /transactions endpoint for /api prefix
  try {
    const { userId, accessToken } = req.body;
    console.log('Transactions request received:', { userId, hasAccessToken: !!accessToken, requestBody: req.body });
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    let access_token = accessToken;
    console.log('Initial access token:', !!access_token, typeof access_token);

    if (!access_token && process.env.NODE_ENV === 'production') {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        access_token = userDoc.data()?.plaidAccessToken;
        console.log('Got access token from Firestore:', !!access_token);
      } catch (dbError) {
        console.error('Failed to get access token from Firestore:', dbError);
      }
    }
    if (!access_token) {
      console.log('No access token available, returning empty data');
      return res.json({ transactions: [], accounts: [] });
    }

    console.log('Fetching transactions with access token...');
    // Use fetch instead of Plaid SDK
    const today = new Date();
    const start_date = '2024-01-01';
    const end_date = today.toISOString().split('T')[0];
    
    const response = await fetch(`${plaidBaseUrl}/transactions/get`, {
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
    console.log('Got transactions response:', {
      numTransactions: data.transactions?.length,
      numAccounts: data.accounts?.length,
      firstTransaction: data.transactions?.[0]
    });
    
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
app.post('/api/openai/chat', async (req, res) => {
  // Duplicate for /api prefix
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
    console.error('🧠 OpenAI chat error:', error);
    res.status(500).json({ error: 'Failed to generate a response', details: error.message });
  }
});
app.post('/api/openai/chat-with-transactions', async (req, res) => {
  // Duplicate for /api prefix
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
    console.error('🧠 OpenAI chat error:', error);
    res.status(500).json({ error: 'Failed to generate a response', details: error.message });
  }
});

// Additional function to directly call Plaid API for debugging
app.post('/debug-plaid', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  try {
    console.log('Attempting direct Plaid API call with fetch');
    const response = await fetch(`${plaidBaseUrl}/link/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaidClientId,
        'PLAID-SECRET': plaidSecret,
      },
      body: JSON.stringify({
        client_name: 'Ventryx',
        user: { client_user_id: userId },
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en'
      })
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Direct Plaid API call error:', error);
    res.status(500).json({ error: 'Failed to make direct Plaid API call', details: error.message });
  }
});

// Also add the endpoint with the /api prefix
app.post('/api/debug-plaid', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  try {
    console.log('Attempting direct Plaid API call with fetch');
    const response = await fetch(`${plaidBaseUrl}/link/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaidClientId,
        'PLAID-SECRET': plaidSecret,
      },
      body: JSON.stringify({
        client_name: 'Ventryx',
        user: { client_user_id: userId },
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en'
      })
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Direct Plaid API call error:', error);
    res.status(500).json({ error: 'Failed to make direct Plaid API call', details: error.message });
  }
});

// Add request logging middleware
app.use((req, res, next) => {
  // Log all requests with method, path, and basic details
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  
  // For token-related requests, log additional information to help debug
  if (req.path.includes('token') || req.path.includes('transaction')) {
    console.log('Request details:', {
      hasUserId: !!req.body.userId,
      hasAccessToken: !!req.body.accessToken,
      hasPublicToken: !!req.body.publicToken
    });
  }
  
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Start server if running directly (not as a module)
if (require.main === module) {
  const PORT = process.env.PORT || 8080;  // Default to 8080 for Cloud Run or other production environments
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;