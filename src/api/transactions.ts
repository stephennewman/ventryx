const API_URL = import.meta.env.VITE_API_URL || '/.netlify/functions';

export async function getTransactions(accessToken: string) {
  const response = await fetch(`${API_URL}/get-transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accessToken }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to fetch transactions');
  }

  return response.json();
}

export async function chatWithTransactions(messages: any[], transactions: any[]) {
  const response = await fetch(`${API_URL}/chat-with-transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, transactions }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to chat with AI');
  }

  return response.json();
} 