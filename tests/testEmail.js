const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function createApiKey() {
  try {
    const response = await resend.apiKeys.create({ name: 'Production' });
    console.log('API Key created:', response);
  } catch (error) {
    console.error('Error creating API Key:', error);
  }
}

createApiKey();

const { sendEmail } = require('./functions/emailService');

const testTransaction = async () => {
  const transactionDetails = {
    userEmail: 'test@example.com',
    userName: 'Test User',
    amount: '$100.00',
  };

  try {
    // Simulate transaction processing
    console.log('Processing test transaction...');

    // Send email
    const to = transactionDetails.userEmail;
    const subject = 'Test Transaction Successful';
    const body = `Dear ${transactionDetails.userName}, your test transaction of ${transactionDetails.amount} was successful.`;

    await sendEmail(to, subject, body);
    console.log('Test transaction email sent successfully');
  } catch (error) {
    console.error('Error during test transaction:', error);
  }
};

// Run the test
testTransaction();
