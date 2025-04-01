import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

export interface Account {
  account_id: string;
  name: string;
  type: string;
  subtype: string;
  balances: {
    current: number | null;
    available: number | null;
    iso_currency_code: string;
  };
  mask: string;
  official_name: string | null;
}

export interface Transaction {
  transaction_id: string;
  account_id: string;
  date: string;
  name: string;
  amount: number;
  iso_currency_code: string;
  category: string[];
  category_id: string;
  payment_channel?: string;
}

// Determine the Plaid environment from environment variables
const plaidEnv = import.meta.env.VITE_PLAID_ENV as keyof typeof PlaidEnvironments || 'sandbox';
console.log(`Using Plaid ${plaidEnv} environment in plaid.ts`);

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