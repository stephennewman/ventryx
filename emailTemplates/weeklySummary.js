function generateWeeklySummaryEmail({ name, categories, pacing, insight }) {
    const greeting = `<h2>Hi ${name} 👋</h2>`;
    const pacingText = `<p>Your budget is <strong>${pacing}</strong> this week.</p>`;
  
    const categoryRows = categories.map(cat => {
      const statusEmoji = cat.status === 'over' ? '❗' : cat.status === 'under' ? '✅' : '⏸️';
      const statusLabel = cat.status.charAt(0).toUpperCase() + cat.status.slice(1);
      return `
        <tr>
          <td>${cat.name}</td>
          <td>$${cat.spent}</td>
          <td>$${cat.budget}</td>
          <td>${statusEmoji} ${statusLabel}</td>
        </tr>
      `;
    }).join('');
  
    return `
      <div style="font-family: sans-serif; padding: 24px; color: #333;">
        ${greeting}
        ${pacingText}
  
        <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
          <thead>
            <tr>
              <th align="left">Category</th>
              <th align="left">Spent</th>
              <th align="left">Budget</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${categoryRows}
          </tbody>
        </table>
  
        <p style="margin-top: 20px;">
          💡 <strong>Insight:</strong> ${insight}
        </p>
  
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
  