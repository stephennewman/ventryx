const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
require('dotenv').config();
const app = express();
const userCursors = {}; // In-memory store: userId -> cursor
const userAccessTokens = {}; // In-memory store: userId -> access_token


// Configure CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5176'],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Log environment variables (without exposing secrets)
console.log('Plaid Client ID:', process.env.VITE_PLAID_CLIENT_ID ? 'Present' : 'Missing');
console.log('Plaid Secret:', process.env.VITE_PLAID_SECRET ? 'Present' : 'Missing');

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.VITE_PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.VITE_PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/create-link-token', async (req, res) => {
  try {
    console.log('Received request to create link token for user:', req.body.userId);
    
    if (!req.body.userId) {
      throw new Error('User ID is required');
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.body.userId },
      client_name: 'Ventryx',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    });
    
    console.log('Successfully created link token');
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to create link token',
      details: error.response?.data || error.message
    });
  }
});

app.post('/api/exchange-token', async (req, res) => {
  try {
    console.log('Received request to exchange token');

    const { public_token, user_id } = req.body;
    if (!public_token) throw new Error('Public token is required');
    if (!user_id) throw new Error('User ID is required');

    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = response.data.access_token;

    // 🔐 Store access token per user
    userAccessTokens[user_id] = accessToken;

    console.log(`✅ Stored access token for user: ${user_id}`);

    res.json({ access_token: accessToken });
  } catch (error) {
    console.error('Error exchanging token:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to exchange token',
      details: error.response?.data || error.message
    });
  }
});

app.post('/api/transactions/sync', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) throw new Error('User ID is required');
    const accessToken = userAccessTokens[user_id];
    if (!accessToken) throw new Error('Access token not found for user');

    let cursor = userCursors[user_id] || null;
    const allAdded = [];

    do {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: cursor,
      });

      allAdded.push(...response.data.added);
      cursor = response.data.next_cursor;

      if (!response.data.has_more) break;
    } while (true);

    // Store updated cursor
    userCursors[user_id] = cursor;

    res.json({ added: allAdded });
  } catch (error) {
    console.error('Error syncing transactions:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to sync transactions',
      details: error.response?.data || error.message
    });
  }
});


app.post('/api/transactions', async (req, res) => {
  try {
    console.log('Fetching transactions');
    
    if (!req.body.access_token) {
      throw new Error('Access token is required');
    }

    const response = await plaidClient.transactionsGet({
      access_token: req.body.access_token,
      start_date: '2024-01-01',
      end_date: new Date().toISOString().split('T')[0],
      options: {
        count: 100,
        offset: 0
      }
    });
    
    console.log('Successfully fetched transactions');
    res.json({ 
      transactions: response.data.transactions,
      accounts: response.data.accounts 
    });
  } catch (error) {
    console.error('Error fetching transactions:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to fetch transactions',
      details: error.response?.data || error.message
    });
  }
});

// Add a webhook endpoint to handle new transaction notifications
app.post('/api/webhook/transactions', (req, res) => {
    console.log('Received webhook for new transaction:', req.body);
    // TODO: Add logic to process the transaction data
    // For example, update the database, send notifications, etc.

    // Respond to acknowledge receipt of the webhook
    res.status(200).send('Webhook received');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: err.message
  });
});

const PORT = process.env.PORT || 5176;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
}); 