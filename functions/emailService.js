const axios = require('axios');
require('dotenv').config();

const sendEmail = async (options) => {
  try {
    const emailData = {
      from: 'stephen@krezzo.com',
      to: options.to,
      ...(options.subject && { subject: options.subject }),
      ...(options.isPlainText ? { text: options.text } : { html: options.html })
    };

    const response = await axios.post('https://api.resend.com/emails', emailData, {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Email sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending email:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = { sendEmail };