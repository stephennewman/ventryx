const { sendEmail } = require('./functions/emailService');
const { generateWeeklySummaryEmail } = require('./emailTemplates/weeklySummary');

const summaryHtml = generateWeeklySummaryEmail({
  name: 'Stephen',
  pacing: 'slightly over budget',
  insight: 'Dining spend is trending up — try setting a daily limit.',
  categories: [
    { name: 'Groceries 🍎', spent: 120, budget: 150, status: 'under' },
    { name: 'Dining 🍔', spent: 90, budget: 60, status: 'over' },
    { name: 'Subscriptions 💻', spent: 40, budget: 40, status: 'even' }
  ]
});

sendEmail(
  'stephen@krezzo.com',
  '💸 Your Weekly Budget Summary – Powered by Ventryx',
  summaryHtml
);
