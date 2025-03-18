const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
require('dotenv').config();

const app = express();

// Configure CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5176'],
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
    
    if (!req.body.public_token) {
      throw new Error('Public token is required');
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: req.body.public_token,
    });
    
    console.log('Successfully exchanged token');
    res.json({ access_token: response.data.access_token });
  } catch (error) {
    console.error('Error exchanging token:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to exchange token',
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