import React from 'react';
import { usePlaidLink } from 'react-plaid-link';

const API_URL = 'http://localhost:5176/api';

export default function App() {
  const [linkToken, setLinkToken] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      try {
        const response = await fetch(`${API_URL}/exchange-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicToken: public_token })
        });
        await response.json();
      } catch (error) {
        console.error('Error exchanging token:', error);
      }
    }
  });

  React.useEffect(() => {
    const getToken = async () => {
      try {
        const response = await fetch(`${API_URL}/create-link-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'test-user' })
        });
        const data = await response.json();
        setLinkToken(data.link_token);
      } catch (error) {
        console.error('Error getting link token:', error);
      }
    };
    getToken();
  }, []);

  return (
    <div>
      {!ready ? (
        <div>Loading...</div>
      ) : (
        <button onClick={() => open()}>Connect a bank account</button>
      )}
    </div>
  );
} 