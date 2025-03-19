import React, { useState, useEffect } from 'react';
import { signInWithGoogle, logOut, auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { usePlaidLink, PlaidLinkError } from 'react-plaid-link';
import { plaidClient, Transaction, Account } from './plaid';
import TransactionFeed from './components/TransactionFeed';
import { Products, CountryCode } from 'plaid';

interface PlaidEvent {
  eventName: string;
  metadata: Record<string, any>;
}

const API_URL = `${import.meta.env.VITE_API_URL}/api` || 'http://localhost:5176/api';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      console.log('User state changed:', currentUser ? 'Signed in' : 'Signed out');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const createLinkToken = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        setError(null);
        console.log('Creating link token for user:', user.uid);
        
        const response = await fetch(`${API_URL}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            action: 'create-link-token',
            user_id: user.uid 
          }),
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error(`Unexpected response type: ${contentType}`);
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Link token created successfully:', data);
        if (!data.link_token) {
          throw new Error('No link token in response');
        }
        setLinkToken(data.link_token);
      } catch (err) {
        console.error('Error creating link token:', err);
        setError(err instanceof Error ? err.message : 'Failed to create link token');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      createLinkToken();
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      console.log('Fetching transactions from backend');
      const response = await fetch(`${API_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'transactions',
          userId: user.uid
        }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Unexpected response type: ${contentType}`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Successfully fetched transactions:', data);
      setTransactions(data.transactions);
      setAccounts(data.accounts);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    }
  };

  const handlePlaidSuccess = async (publicToken: string) => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      setIsLoading(true);
      setError(null);
      console.log('Plaid Link success callback received public token:', publicToken);
      
      const requestBody = { 
        action: 'exchange-token',
        publicToken: publicToken,
        userId: user.uid
      };
      console.log('Sending request to backend:', requestBody);
      
      const response = await fetch(`${API_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Unexpected response type: ${contentType}`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Successfully exchanged token:', data);
      
      // Fetch initial transactions
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
    onEvent: (eventName: string, metadata: Record<string, any>) => {
      console.log('Plaid Link event:', eventName, metadata);
    },
    onLoad: () => {
      console.log('Plaid Link loaded');
    },
    language: 'en',
    countryCodes: ['US'],
    env: 'sandbox'
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Ventryx</h1>
          <p className="text-xl text-gray-600">Your real-time money helper</p>
        </div>

        {user ? (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt="User Avatar"
                      className="w-12 h-12 rounded-full"
                    />
                  )}
                  <div className="text-left">
                    <h2 className="text-xl font-semibold">{user.displayName}</h2>
                    <p className="text-gray-600">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => logOut()}
                    className="text-gray-400 hover:text-gray-600 font-medium"
                  >
                    Sign Out
                  </button>

                  {isLoading ? (
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : accounts.length > 0 ? (
                    <button
                      onClick={() => {
                        if (linkToken && ready) {
                          open();
                        }
                      }}
                      disabled={!ready || !linkToken}
                      className="bg-green-600 text-white font-semibold px-6 py-3 rounded-lg shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Connected • Add Another Account</span>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (linkToken && ready) {
                          open();
                        }
                      }}
                      disabled={!ready || !linkToken}
                      className={`bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
                        (!ready || !linkToken) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {!linkToken ? 'Loading...' : 'Connect Your Bank Account'}
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                  <span className="block sm:inline">{error}</span>
                </div>
              )}

              <div className="space-y-8 mt-8">
                <div className="grid grid-cols-1 gap-4">
                  {accounts.map(account => (
                    <div key={account.account_id} className="bg-blue-50 p-4 rounded-lg shadow-md">
                      <div className="flex justify-between items-start">
                        <div className="text-left">
                          <h3 className="text-lg font-semibold text-gray-800">{account.name}</h3>
                          <p className="text-sm text-gray-600">{account.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-gray-900">
                            ${account.balances.current?.toFixed(2) || '0.00'}
                          </p>
                          <p className="text-sm text-gray-600">
                            Available: ${account.balances.available?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8">
                  <h3 className="text-xl font-semibold mb-4">Recent Transactions</h3>
                  <TransactionFeed transactions={transactions} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => signInWithGoogle()}
              className="bg-white text-gray-800 font-semibold py-2 px-4 border border-gray-400 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Sign in with Google
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App; 