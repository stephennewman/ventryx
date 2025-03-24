const cron = require('node-cron');
const { sendEmail } = require('./functions/emailService');
const { generateWeeklySummaryEmail } = require('./functions/weeklySummaryEmailTemplate');

// Schedule to run every Sunday at midnight
cron.schedule('0 0 * * 0', async () => {
  try {
    const to = process.env.TEST_EMAIL || 'stephen@krezzo.com';
    const subject = 'Your Weekly Financial Summary';
    const summary = ['Test Item 1', 'Test Item 2', 'Test Item 3']; // Replace with actual data
    const html = generateWeeklySummaryEmail('Test User', summary);

    await sendEmail(to, subject, html);
    console.log('Weekly summary email sent successfully');
  } catch (error) {
    console.error('Error sending weekly summary email:', error);
  }
}); 