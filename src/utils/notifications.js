const { sendTextViaEmail } = require('../../sendTextViaEmail');

async function sendTransactionAlert(phoneNumber, transaction) {
  const amount = transaction.amount.toFixed(2);
  const merchant = transaction.merchant_name || 'Unknown Merchant';
  
  const message = `New transaction: $${amount} at ${merchant}`;
  
  try {
    await sendTextViaEmail(phoneNumber, message, 'tmobile');
    console.log('Transaction alert sent successfully');
  } catch (error) {
    console.error('Failed to send transaction alert:', error);
  }
}

async function sendLowBalanceAlert(phoneNumber, account) {
  const balance = account.balances.current.toFixed(2);
  const accountName = account.name;
  
  const message = `Low balance alert: ${accountName} has $${balance} remaining`;
  
  try {
    await sendTextViaEmail(phoneNumber, message, 'tmobile');
    console.log('Low balance alert sent successfully');
  } catch (error) {
    console.error('Failed to send low balance alert:', error);
  }
}

async function sendWeeklySummary(phoneNumber, summary) {
  const { totalSpent, topCategory, savingsProgress } = summary;
  
  const message = `Weekly Summary:
- Total Spent: $${totalSpent}
- Top Category: ${topCategory}
- Savings Progress: ${savingsProgress}%`;
  
  try {
    await sendTextViaEmail(phoneNumber, message, 'tmobile');
    console.log('Weekly summary sent successfully');
  } catch (error) {
    console.error('Failed to send weekly summary:', error);
  }
}

module.exports = {
  sendTransactionAlert,
  sendLowBalanceAlert,
  sendWeeklySummary
}; 