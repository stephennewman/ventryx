import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Determine the Plaid environment from environment variables
const plaidEnv = import.meta.env.VITE_PLAID_ENV as keyof typeof PlaidEnvironments || 'sandbox';
console.log(`Using Plaid ${plaidEnv} environment in config/plaid.ts`);

const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': import.meta.env.VITE_PLAID_CLIENT_ID,
      'PLAID-SECRET': import.meta.env.VITE_PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration); 