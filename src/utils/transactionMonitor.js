const { sendTransactionAlert, sendLowBalanceAlert } = require('./notifications');

async function processNewTransactions(userId, phoneNumber, transactions, accounts) {
  // Process each new transaction
  for (const transaction of transactions) {
    // Alert for large transactions (e.g., over $500)
    if (Math.abs(transaction.amount) > 500) {
      await sendTransactionAlert(phoneNumber, transaction);
    }
  }

  // Check account balances
  for (const account of accounts) {
    // Alert for low balance (e.g., under $100)
    if (account.balances.current < 100) {
      await sendLowBalanceAlert(phoneNumber, account);
    }
  }
}

module.exports = {
  processNewTransactions
}; 