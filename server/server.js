const express = require('express');
const cors = require('cors');
const path = require('path');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const { OpenAI } = require('openai');
const admin = require('firebase-admin');

// Load environment variables based on NODE_ENV
if (!process.env.PLAID_CLIENT_ID) {  // Only load if not already loaded by functions
  const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
  require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
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
        const serviceAccount = require('../firebase-service-account.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
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

const db = admin.firestore();

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
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

// Plaid client setup with environment-specific configuration
const configuration = new Configuration({
  basePath: process.env.NODE_ENV === 'production' ? PlaidEnvironments.production : PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// OpenAI setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Plaid endpoints
app.post('/api/create-link-token', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const config = {
      user: { client_user_id: userId },
      client_name: 'Ventryx',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    };

    // For testing environment, return mock data
    if (process.env.NODE_ENV === 'test') {
      return res.json({ link_token: 'test-link-token' });
    }

    const response = await plaidClient.linkTokenCreate(config);
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Plaid create-link-token error:', error);
    res.status(500).json({ error: 'Failed to create link token', details: error.message });
  }
});

app.post('/api/exchange-token', async (req, res) => {
  const { publicToken, userId } = req.body;
  
  if (!publicToken || !userId) {
    return res.status(400).json({ error: 'Public token and user ID are required' });
  }

  console.log('Exchanging public token for access token...');
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken
    });
    
    try {
      // Store the access token in Firestore if available
      const userRef = db.collection('users').doc(userId);
      await userRef.set({
        plaidAccessToken: response.data.access_token
      }, { merge: true });
    } catch (dbError) {
      console.warn('Failed to store access token in Firestore:', dbError);
      // Continue anyway - the token exchange was successful
    }

    // Return the access token to the client in development
    // In production, we never send the access token to the client
    const responseData = {
      success: true
    };
    if (process.env.NODE_ENV !== 'production') {
      responseData.accessToken = response.data.access_token;
    }
    res.json(responseData);
  } catch (error) {
    console.error('Plaid exchange-token error:', error);
    res.status(500).json({ 
      error: 'Failed to exchange token', 
      details: error.message,
      code: error.response?.data?.error_code
    });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { userId, accessToken } = req.body;
    console.log('Transactions request received:', { 
      userId, 
      hasAccessToken: !!accessToken,
      requestBody: req.body  // Log the full request body
    });

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    let access_token = accessToken;  // Use provided access token in development
    console.log('Initial access token:', !!access_token, typeof access_token);

    if (!access_token && process.env.NODE_ENV === 'production') {
      try {
        // In production, get the access token from Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        access_token = userDoc.data()?.plaidAccessToken;
        console.log('Got access token from Firestore:', !!access_token);
      } catch (dbError) {
        console.error('Failed to get access token from Firestore:', dbError);
      }
    }

    // If no access token available, return empty data
    if (!access_token) {
      console.log('No access token available, returning empty data');
      return res.json({
        transactions: [],
        accounts: []
      });
    }

    console.log('Fetching transactions with access token...');
    const response = await plaidClient.transactionsGet({
      access_token: access_token,
      start_date: '2024-01-01',
      end_date: new Date().toISOString().split('T')[0],
      options: { count: 100, offset: 0 }
    });

    console.log('Got transactions response:', {
      numTransactions: response.data.transactions?.length,
      numAccounts: response.data.accounts?.length,
      firstTransaction: response.data.transactions?.[0]  // Log the first transaction for debugging
    });

    res.json({
      transactions: response.data.transactions,
      accounts: response.data.accounts
    });
  } catch (error) {
    console.error('Plaid transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
  }
});

// ✅ OpenAI chat endpoint clearly integrated
app.post('/api/openai/chat', async (req, res) => {
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

app.post('/api/openai/chat-with-transactions', async (req, res) => {
  const { messages, transactions } = req.body;

  // Validate input
  if (!Array.isArray(messages) || !Array.isArray(transactions)) {
    return res.status(400).json({
      error: 'messages and transactions are required and must be arrays',
    });
  }

  try {
    // System prompt for the AI assistant
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Start server if running directly (not as a module)
if (require.main === module) {
  const PORT = process.env.PORT || 5176;  // Use environment-specific port configuration
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
