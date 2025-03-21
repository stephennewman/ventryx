function generateWelcomeEmail(name) {
  return `
    <h1>Welcome, ${name}!</h1>
    <p>Thanks for signing up!</p>
    <p>This is the start of you taking control of your finances - let's go!</p>
    <p>Best regards,<br>The Ventryx Team</p>
  `;
}

module.exports = { generateWelcomeEmail };
