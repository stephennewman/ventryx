const { sendEmail } = require('./functions/emailService');

const CARRIER_GATEWAYS = {
  tmobile: '@tmomail.net',
  att: '@txt.att.net',
  verizon: '@vtext.com',
  sprint: '@messaging.sprintpcs.com'
};

const sendTextViaEmail = async (phoneNumber, message, carrier = 'tmobile') => {
  if (!CARRIER_GATEWAYS[carrier]) {
    throw new Error(`Unsupported carrier: ${carrier}`);
  }

  const to = `${phoneNumber}${CARRIER_GATEWAYS[carrier]}`;
  const emailData = {
    to,
    subject: 'Ventryx',
    text: message,
    isPlainText: true
  };

  try {
    await sendEmail(emailData);
    console.log(`Text message sent via ${carrier} email-to-SMS gateway`);
    return true;
  } catch (error) {
    console.error('Error sending text message:', error);
    throw error;
  }
};

module.exports = { sendTextViaEmail, CARRIER_GATEWAYS };

// Example usage (commented out)
// sendTextViaEmail('6173472721', 'Hello! This is a test message.', 'tmobile'); 