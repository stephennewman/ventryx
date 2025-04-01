const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const configuration = new Configuration({
  basePath: PlaidEnvironments.production,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

app.post('/api/create-link-token', async (req, res) => {
  try {
    console.log('Creating link token with Plaid API...');
    console.log('User ID:', req.body.userId);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Plaid Client ID:', process.env.PLAID_CLIENT_ID);
    console.log('Plaid Secret length:', process.env.PLAID_SECRET ? process.env.PLAID_SECRET.length : 'undefined');
    
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.body.userId },
      client_name: 'Ventryx',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    });
    console.log('Link token created successfully:', response.data.link_token.substring(0, 10) + '...');
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error);
    console.error('Error details:', error.response?.data || 'No detailed error info');
    res.status(500).json({ error: 'Failed to create link token', details: error.message });
  }
});

const PORT = process.env.PORT || 5176;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 