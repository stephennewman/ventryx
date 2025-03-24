const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { messages, transactions } = JSON.parse(event.body);

    // Validate input
    if (!Array.isArray(messages) || !Array.isArray(transactions)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'messages and transactions are required and must be arrays',
        }),
      };
    }

    // System prompt for the AI assistant
    const systemPrompt = `
You are a helpful financial assistant. You have access to a user's transaction history and help answer questions, analyze spending, and forecast budgets.

Respond in markdown. Be concise but informative. Use bullet points or tables when helpful.

Current date is ${new Date().toLocaleDateString()}. The transaction data starts from January 1, 2025.

Capabilities:
- Calculate totals, averages, frequencies
- Identify spending by date, merchant, category
- Offer budgeting or saving tips
- Forecast likely monthly spending based on existing patterns

Only reference the data if the prompt relates to transactions or spending.
If the user's message is conversational or general, respond appropriately without referencing their data.
    `.trim();

    // Format transaction data for context
    const formattedTransactions = transactions.map(txn => ({
      date: txn.date,
      name: txn.name,
      amount: txn.amount,
      category: txn.category?.[0] || 'Uncategorized',
    }));
    const dataString = JSON.stringify(formattedTransactions, null, 2);

    // Last message from the user
    const lastUserMessage = messages.slice().reverse().find(msg => msg.role === 'user')?.content || '';

    // Check if the message is related to spending
    const financialKeywords = /spend|purchase|cost|transaction|budget|buy|bought|amount|paid|expense|Uber|Starbucks|total/i;
    const shouldInjectData = financialKeywords.test(lastUserMessage);

    // Compose final messages
    const finalMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    if (shouldInjectData) {
      finalMessages.push({
        role: 'user',
        content: `Here are the user's transactions:\n${dataString}`,
      });
    }

    // Send to OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: finalMessages,
      temperature: 0.7,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: completion.choices[0].message.content,
      }),
    };
  } catch (error) {
    console.error('🧠 OpenAI chat error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to generate a response',
        details: error.message,
      }),
    };
  }
}; 