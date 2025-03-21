function generateWeeklySummaryEmail({ name, merchants }) {
  const greeting = `<h2>Hi ${name} 👋</h2>`;

  const merchantRows = merchants.map(merchant => {
    return `
      <tr>
        <td>${merchant.name}</td>
        <td>$${merchant.totalSpent}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family: sans-serif; padding: 24px; color: #333;">
      ${greeting}

      <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
        <thead>
          <tr>
            <th align="left">Merchant</th>
            <th align="left">Total Spent</th>
          </tr>
        </thead>
        <tbody>
          ${merchantRows}
        </tbody>
      </table>

      <a href="https://app.ventryx.com" 
         style="display: inline-block; margin-top: 20px; padding: 12px 20px; background: #1d4ed8; color: white; text-decoration: none; border-radius: 6px;">
        View Full Report →
      </a>

      <hr style="margin: 32px 0;" />
      <p style="font-size: 12px; color: #999;">
        You're receiving this email because you're a Ventryx user.
      </p>
    </div>
  `;
}

module.exports = { generateWeeklySummaryEmail };
  