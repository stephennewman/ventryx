const request = require('supertest');

// Mock OpenAI before requiring the server
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }]
        })
      }
    }
  }))
}));

// Mock Plaid before requiring the server
jest.mock('plaid', () => {
  const mockPlaidApi = {
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
  };

  return {
    Configuration: jest.fn(),
    PlaidApi: jest.fn(() => mockPlaidApi),
    PlaidEnvironments: {
      production: 'https://production.plaid.com'
    }
  };
});

const app = require('../../server/server');

describe('API Endpoints', () => {
  describe('Health Check', () => {
    it('should return status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  });

  describe('Plaid Integration', () => {
    describe('POST /api/create-link-token', () => {
      it('should return 400 without userId', async () => {
        const res = await request(app)
          .post('/api/create-link-token')
          .send({});
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
      });

      it('should create link token with valid userId', async () => {
        const res = await request(app)
          .post('/api/create-link-token')
          .send({ userId: 'test-user-id' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('link_token');
      });
    });

    describe('POST /api/exchange-token', () => {
      it('should return 400 without required fields', async () => {
        const res = await request(app)
          .post('/api/exchange-token')
          .send({});
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
      });

      it('should handle invalid public token', async () => {
        const res = await request(app)
          .post('/api/exchange-token')
          .send({ 
            publicToken: 'invalid-token',
            userId: 'test-user-id'
          });
        expect(res.statusCode).toBe(500);
        expect(res.body).toHaveProperty('error');
      });
    });

    describe('POST /api/transactions', () => {
      it('should return 400 without userId', async () => {
        const res = await request(app)
          .post('/api/transactions')
          .send({});
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
      });

      it('should return empty arrays without access token', async () => {
        const res = await request(app)
          .post('/api/transactions')
          .send({ userId: 'test-user-id' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('transactions', []);
        expect(res.body).toHaveProperty('accounts', []);
      });
    });
  });
}); 