import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { signInWithGoogle, logOut, auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { usePlaidLink, PlaidLinkError } from 'react-plaid-link';
import { plaidClient, Transaction, Account } from './plaid';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import TransactionFeed from './components/TransactionFeed';
import ChatDrawer from './components/ChatDrawer';
import PostSSOWelcome from './components/PostSSOWelcome';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
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
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      console.log('User state changed:', currentUser ? 'Signed in' : 'Signed out');
      
      if (currentUser) {
        console.log('Profile Image URL:', currentUser.photoURL);
        scrollToTop();
        
        // Check if user has completed onboarding
        try {
          const db = getFirestore();
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          setHasCompletedOnboarding(userDoc.exists());
        } catch (error) {
          console.error('Error checking onboarding status:', error);
        } finally {
          setIsCheckingOnboarding(false);
        }
      } else {
        setIsCheckingOnboarding(false);
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

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
  };

  const MainContent = () => (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <img
            src="https://blog.krezzo.com/hs-fs/hubfs/Krezzo-Logo-2023-Light.png?width=3248&height=800"
            alt="Logo"
            className="mx-auto mb-2"
            style={{ width: 'auto', height: '32px' }}
          />
        </div>

        {user ? (
          isCheckingOnboarding ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : hasCompletedOnboarding ? (
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
                <div className="fixed bottom-4 right-4">
                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </button>
                  <ChatDrawer
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                    transactions={transactions}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8">
              <PostSSOWelcome user={user} onComplete={handleOnboardingComplete} />
            </div>
          )
        ) : (
          <div className="flex flex-col items-center mt-8 space-y-4">
            <button 
              onClick={signInWithGoogle}
              className="bg-blue-600 text-white border py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign up with Google
            </button>
            <div className="flex items-center space-x-2">
              <div className="h-px w-16 bg-gray-300"></div>
              <span className="text-sm text-gray-500">or</span>
              <div className="h-px w-16 bg-gray-300"></div>
            </div>
            <button 
              onClick={signInWithGoogle} 
              className="bg-white border py-2 px-6 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign in with Google
            </button>
            <p className="text-sm text-gray-500 mt-4">
              By signing up, you agree to our{' '}
              <Link to="/terms-of-service" className="text-blue-600 hover:text-blue-800">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy-policy" className="text-blue-600 hover:text-blue-800">
                Privacy Policy
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Router>
      <Routes>
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/" element={<MainContent />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
