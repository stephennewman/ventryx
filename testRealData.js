const { sendEmail } = require('./functions/emailService');
const { generateWeeklySummaryEmail } = require('./emailTemplates/weeklySummary');
const cron = require('node-cron');
const { runTest } = require('./runRealDataTest'); // Ensure this function is exported from your script

// Helper function to categorize and summarize transactions
function analyzeTransactions(transactions) {
  const merchants = {};
  const now = new Date();
  const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1));

  // Group transactions by merchant, excluding deposits/credits
  transactions.forEach(transaction => {
    if (transaction.amount > 0) return; // Exclude deposits/credits

    const merchant = transaction.merchant_name || 'Unknown Merchant';

    // Process merchants
    if (!merchants[merchant]) {
      merchants[merchant] = {
        spent: 0,
        transactions: []
      };
    }
    merchants[merchant].spent += Math.abs(transaction.amount);
    merchants[merchant].transactions.push(transaction);
  });

  // Create a summary of expenses by merchant, sorted from highest to lowest
  const merchantSummary = Object.entries(merchants)
    .map(([name, data]) => ({
      name: name,
      totalSpent: Math.round(data.spent)
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);

  return {
    merchants: merchantSummary
  };
}

// Helper function to get emoji for category
function getCategoryEmoji(category) {
  const emojiMap = {
    'Food and Drink': '🍽️',
    'Groceries': '🛒',
    'Transportation': '🚗',
    'Shopping': '🛍️',
    'Entertainment': '🎮',
    'Travel': '✈️',
    'Bills and Utilities': '📱',
    'Healthcare': '🏥',
    'Transfer': '💳',
    'Payment': '💰',
    'Other': '📌'
  };
  return emojiMap[category] || '📌';
}

async function testWithRealData(transactions, userEmail, userName) {
  try {
    console.log('Analyzing transactions...');
    const analysis = analyzeTransactions(transactions);

    console.log('Generating email with real data...');
    const emailHtml = generateWeeklySummaryEmail({
      name: userName,
      merchants: analysis.merchants
    });

    console.log('Sending test email...');
    await sendEmail(
      userEmail,
      '💸 Your Monthly Spending Summary (Test with Real Data)',
      emailHtml
    );

    console.log('Test email sent successfully with real transaction data');
    
    // Log analysis for verification
    console.log('\nTransaction Analysis:');
    console.log('Merchants:', analysis.merchants);
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Export for use in other files
module.exports = { testWithRealData, analyzeTransactions };

// Schedule the task to run every Friday at 5 PM EST
cron.schedule('0 17 * * 5', () => {
  console.log('Running scheduled task...');
  runTest();
}, {
  timezone: "America/New_York" // Set the timezone to EST
}); 