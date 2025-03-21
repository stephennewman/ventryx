const axios = require('axios');
require('dotenv').config();

const sendEmail = async (to, subject, html) => {
  try {
    const response = await axios.post('https://api.resend.com/emails', {
      from: 'noreply@krezzo.com',
      to,
      subject,
      html,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Email sent successfully:', response.data);
  } catch (error) {
    console.error('Error sending email:', error.response?.data || error.message);
  }
};

module.exports = { sendEmail };