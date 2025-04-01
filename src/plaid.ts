import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { getPlaidConfig } from './config/plaid';

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
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  pending: boolean;
  category: string[];
  location?: {
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
  payment_channel?: string;
}

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