const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

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

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { accessToken } = JSON.parse(event.body);

    if (!accessToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'accessToken is required',
        }),
      };
    }

    // Get transactions from the last 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();

    const request = {
      access_token: accessToken,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      options: {
        include_personal_finance_category: true,
      },
    };

    const response = await plaidClient.transactionsGet(request);
    let transactions = response.data.transactions;

    // Get all transactions if there are more
    while (transactions.length < response.data.total_transactions) {
      const paginatedRequest = {
        ...request,
        offset: transactions.length,
      };
      const paginatedResponse = await plaidClient.transactionsGet(paginatedRequest);
      transactions = transactions.concat(paginatedResponse.data.transactions);
    }

    // Format transactions
    const formattedTransactions = transactions.map(transaction => ({
      id: transaction.transaction_id,
      name: transaction.merchant_name || transaction.name,
      date: transaction.date,
      amount: transaction.amount,
      category: transaction.personal_finance_category 
        ? [transaction.personal_finance_category.primary, transaction.personal_finance_category.detailed]
        : transaction.category,
      pending: transaction.pending,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactions: formattedTransactions,
      }),
    };
  } catch (error) {
    console.error('🏦 Plaid transactions error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch transactions',
        details: error.message,
      }),
    };
  }
}; 