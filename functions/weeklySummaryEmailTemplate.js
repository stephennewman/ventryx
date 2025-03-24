function generateWeeklySummaryEmail(name, summary) {
  return `
    <h1>Weekly Summary for ${name}</h1>
    <p>Here's what happened this week:</p>
    <ul>
      ${summary.map(item => `<li>${item}</li>`).join('')}
    </ul>
    <p>Best regards,<br>The Krezzo Team</p>
  `;
}

module.exports = { generateWeeklySummaryEmail }; 