import '@testing-library/jest-dom';
import 'openai/shims/node';

// Set test environment
process.env.NODE_ENV = 'test';

// Mock environment variables
process.env.PLAID_CLIENT_ID = 'test-client-id';
process.env.PLAID_SECRET = 'test-secret';
process.env.PLAID_ENV = 'sandbox';
process.env.VITE_API_URL = 'http://localhost:5176';
process.env.VITE_PLAID_ENV = 'sandbox';

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ exists: false })),
        set: jest.fn(() => Promise.resolve()),
        update: jest.fn(() => Promise.resolve())
      }))
    }))
  }))
}));

// Mock Plaid client
jest.mock('plaid', () => ({
  Configuration: jest.fn(),
  PlaidApi: jest.fn(() => ({
    linkTokenCreate: jest.fn().mockResolvedValue({
      data: { link_token: 'test-link-token' }
    }),
    itemPublicTokenExchange: jest.fn().mockResolvedValue({
      data: { access_token: 'test-access-token' }
    }),
    transactionsSync: jest.fn().mockResolvedValue({
      data: { 
        added: [],
        modified: [],
        removed: [],
        has_more: false
      }
    })
  })),
  PlaidEnvironments: {
    sandbox: 'https://sandbox.plaid.com'
  }
}));

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
    status: 200
  })
); 