import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Centralized Plaid configuration
export const getPlaidConfig = () => {
  const env = import.meta.env.VITE_PLAID_ENV || 'sandbox';
  
  return {
    environment: env,
    basePath: PlaidEnvironments[env],
    clientName: 'Ventryx',
    products: ['transactions'],
    countryCodes: ['US'],
    language: 'en'
  };
};

// Create the configuration for the Plaid client
const plaidConfig = getPlaidConfig();

const configuration = new Configuration({
  basePath: plaidConfig.basePath,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': import.meta.env.VITE_PLAID_CLIENT_ID,
      'PLAID-SECRET': import.meta.env.VITE_PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration); 