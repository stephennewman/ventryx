import React, { useState, useEffect } from 'react';
import { signInWithGoogle, logOut, auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { usePlaidLink, PlaidLinkError } from 'react-plaid-link';
import { plaidClient, Transaction, Account } from './plaid';
import TransactionFeed from './components/TransactionFeed';
import OpenAIChat from './components/OpenAIChat';
import { scrollToTop } from './utils/scrollManager';

interface PlaidEvent {
  eventName: string;
  metadata: {
    error_code?: string;
    error_message?: string;
    error_type?: string;
    exit_status?: string;
    institution_id?: string;
    institution_name?: string;
    link_session_id?: string;
    request_id?: string;
    status?: string;
    [key: string]: string | undefined;
  };
}

const API_URL = `${import.meta.env.VITE_API_URL}/api` || 'http://localhost:5176/api';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      console.log('User state changed:', currentUser ? 'Signed in' : 'Signed out');
      if (currentUser) {
        console.log('Profile Image URL:', currentUser.photoURL);
        scrollToTop();
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    scrollToTop();
  }, []);

  useEffect(() => {
    const createLinkToken = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`${API_URL}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create-link-token', user_id: user.uid }),
        });

        const data = await response.json();
        setLinkToken(data.link_token);
      } catch (err) {
        console.error('Error creating link token:', err);
        setError(err instanceof Error ? err.message : 'Failed to create link token');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) createLinkToken();
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transactions', userId: user.uid }),
      });

      const data = await response.json();
      setTransactions(data.transactions);
      setAccounts(data.accounts);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    }
  };

  const handlePlaidSuccess = async (publicToken: string) => {
    if (!user) return;

    try {
      setIsLoading(true);
      await fetch(`${API_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exchange-token', publicToken, userId: user.uid }),
      });

      await fetchTransactions();
    } catch (err) {
      console.error('Error exchanging token:', err);
      setError(err instanceof Error ? err.message : 'Failed to exchange token');
    } finally {
      setIsLoading(false);
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: (err: PlaidLinkError | null) => {
      if (err) console.error('Plaid Link exit:', err);
    },
    language: 'en',
    countryCodes: ['US'],
    env: 'sandbox',
  });

  const clearFilters = () => {
    setSelectedAccountId(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <img
            src="https://s3.ca-central-1.amazonaws.com/logojoy/logos/215772753/noBgColor.png?19117.199999999255"
            alt="Logo"
            className="mx-auto mb-2"
            style={{ width: '25%', height: 'auto' }}
          />
        </div>

        {user ? (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  {user.photoURL && (
                    <img src={user.photoURL} alt="User Avatar" className="w-12 h-12 rounded-full" />
                  )}
                  <div className="text-left">
                    <h2 className="text-xl font-semibold">{user.displayName}</h2>
                    <p className="text-gray-600">{user.email}</p>
                  </div>
                </div>

                <button
                  onClick={() => logOut()}
                  className="text-gray-400 hover:text-gray-600 font-medium"
                >
                  Sign Out
                </button>

                <button
                  onClick={() => ready && open()}
                  disabled={!ready || !linkToken}
                  className={`font-semibold px-6 py-3 rounded-lg shadow ${
                    accounts.length > 0
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {accounts.length > 0 ? 'Connected • Add Another Account' : 'Connect Your Bank Account'}
                </button>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                  <span className="block sm:inline">{error}</span>
                </div>
              )}

              <div className="flex space-x-6">
                <div className="w-1/3 space-y-8">
                  {accounts.map(account => (
                    <div
                      key={account.account_id}
                      className="bg-blue-50 p-4 rounded-lg shadow-md cursor-pointer text-left"
                      onClick={() => {
                        setSelectedAccountId(account.account_id);
                        clearFilters();
                      }}
                    >
                      <h3 className="text-lg font-semibold text-left">{account.name}</h3>
                      <p className="text-sm text-gray-600 text-left">{account.type}</p>
                      <p className="text-xl font-bold text-left">${account.balances.current?.toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                <div className="w-2/3">
                  {accounts.length > 0 && (
                    <TransactionFeed
                      transactions={transactions.filter(
                        transaction => !selectedAccountId || transaction.account_id === selectedAccountId
                      )}
                      selectedAccountId={selectedAccountId}
                    />
                  )}
                </div>
              </div>
            </div>

            {generatedText && (
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h2 className="text-xl font-semibold mb-4">Generated Text</h2>
                <p>{generatedText}</p>
              </div>
            )}

            {accounts.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h2 className="text-xl font-semibold mb-4">AI Chat Assistant</h2>
                {/* pass transactions state into your chat */}
                <OpenAIChat transactions={transactions} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center">
            <button onClick={signInWithGoogle} className="bg-white border py-2 px-4 rounded-lg">
              Sign in with Google
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
