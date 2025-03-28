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

// Add this before the App component declaration
window.clearAccountFilter = () => {
  // This will be set properly inside the component
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [userStateLoading, setUserStateLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'account' | 'budget'>('account');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setUserStateLoading(true);
        
        if (currentUser) {
          setUser(currentUser);
          console.log('Profile Image URL:', currentUser.photoURL);
          scrollToTop();
          
          // Check if user has completed onboarding
          const db = getFirestore();
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          setHasCompletedOnboarding(userDoc.exists());
        } else {
          setUser(null);
          setHasCompletedOnboarding(false);
        }
      } catch (error) {
        console.error("Error checking user state:", error);
      } finally {
        setUserStateLoading(false);
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
        const response = await fetch(`${API_URL}/create-link-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid }),
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
      const response = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });

      const data = await response.json();
      setTransactions(data.transactions);
      setAccounts(data.accounts);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token, metadata) => {
      console.log('Success:', { public_token, metadata });
      handlePlaidSuccess(public_token);
    },
    onExit: (err: PlaidLinkError | null) => {
      if (err) {
        console.error('Plaid Link exit with error:', err);
        setError(err.display_message || err.error_message || 'Error connecting to bank');
      }
    },
    language: 'en',
    countryCodes: ['US'],
    env: 'sandbox',
  });

  const handlePlaidSuccess = async (public_token: string) => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Exchanging public token...', public_token);
      const exchangeResponse = await fetch(`${API_URL}/exchange-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicToken: public_token, userId: user.uid }),
      });

      if (!exchangeResponse.ok) {
        const errorData = await exchangeResponse.json();
        throw new Error(errorData.details || 'Failed to exchange token');
      }

      const { accessToken } = await exchangeResponse.json();
      
      console.log('Fetching transactions...');
      const transactionsResponse = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, accessToken }),
      });

      if (!transactionsResponse.ok) {
        const errorData = await transactionsResponse.json();
        throw new Error(errorData.details || 'Failed to fetch transactions');
      }

      const data = await transactionsResponse.json();
      setTransactions(data.transactions);
      setAccounts(data.accounts);
    } catch (err) {
      console.error('Error in Plaid flow:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect bank account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
  };

  // Set up the global handler to clear account selection
  useEffect(() => {
    window.clearAccountFilter = () => {
      setSelectedAccountId(null);
    };
    
    return () => {
      window.clearAccountFilter = () => {};
    };
  }, []);

  const MainContent = () => (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-purple-50">
      <div className="max-w-6xl mx-auto p-6">
        {userStateLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600"> </p>
          </div>
        ) : user ? (
          hasCompletedOnboarding ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                {/* Remove the empty div and user profile from the top bar */}
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  {/* Logo on left */}
                  <div>
                    <img
                      src="https://blog.krezzo.com/hs-fs/hubfs/Krezzo-Logo-2023-Light.png?width=3248&height=800&name=Krezzo-Logo-2023-Light.png"
                      alt="Krezzo Logo"
                      style={{ width: '180px', height: 'auto' }}
                    />
                  </div>
                  
                  {/* User profile on right */}
                  <div className="flex items-center">
                    <div className="text-right mr-4">
                      <div className="relative group inline-block">
                        <div>
                          <h2 className="text-xl font-semibold">{user.displayName}</h2>
                          <p className="text-gray-600">{user.email}</p>
                        </div>
                        <div className="absolute top-full right-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={logOut}
                            className="text-sm text-purple-600 bg-white px-3 py-1 rounded shadow hover:bg-purple-50"
                          >
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </div>
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="User Avatar" className="w-12 h-12 rounded-full" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white text-xl font-semibold">
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Tab Navigation */}
                <div className="mb-6">
                  <div className="flex space-x-4 border-b border-gray-200">
                    <button
                      className={`py-2 px-4 font-medium text-sm focus:outline-none ${
                        activeTab === 'account'
                          ? 'text-purple-600 border-b-2 border-purple-500'
                          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() => setActiveTab('account')}
                    >
                      Account Data
                    </button>
                    <button
                      className={`py-2 px-4 font-medium text-sm focus:outline-none ${
                        activeTab === 'budget'
                          ? 'text-purple-600 border-b-2 border-purple-500'
                          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() => setActiveTab('budget')}
                    >
                      Budget
                    </button>
                  </div>
                </div>
                
                {/* Account Data Tab Content */}
                {activeTab === 'account' && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      {(accounts?.length || 0) === 0 && (
                        <button
                          onClick={() => ready && open()}
                          disabled={!ready || !linkToken || isLoading}
                          className="font-semibold px-6 py-3 rounded-lg shadow text-white bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                        >
                          {isLoading ? 'Loading...' : 'Connect Your Bank Account'}
                        </button>
                      )}
                    </div>

                    {error && (
                      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                        <span className="block sm:inline">{error}</span>
                      </div>
                    )}

                    {isLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading...</p>
                      </div>
                    ) : (
                      <div className="flex space-x-6">
                        <div className="w-1/3 space-y-8">
                          {(accounts || []).map(account => (
                            <div
                              key={account.account_id}
                              className={`bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4 rounded-lg shadow-md cursor-pointer text-left ${
                                selectedAccountId === account.account_id ? 'ring-2 ring-purple-500' : ''
                              }`}
                              onClick={() => {
                                setSelectedAccountId(prevId => 
                                  prevId === account.account_id ? null : account.account_id
                                );
                              }}
                            >
                              <h3 className="text-lg font-semibold text-left">{account.name}</h3>
                              <p className="text-sm text-gray-600 text-left">{account.type}</p>
                              <p className="text-xl font-bold text-left">${account.balances.current?.toFixed(2)}</p>
                            </div>
                          ))}

                          {(accounts?.length || 0) > 0 && (
                            <button
                              onClick={() => ready && open()}
                              disabled={!ready || !linkToken || isLoading}
                              className="w-full bg-white p-4 rounded-lg shadow-md text-left border-2 border-dashed border-purple-200 hover:border-purple-400 transition-colors"
                            >
                              <div className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 flex items-center justify-center text-white mr-3">
                                  <span className="text-xl font-bold">+</span>
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-purple-700">Connected</h3>
                                  <p className="text-sm text-gray-600">Add Another Account</p>
                                </div>
                              </div>
                            </button>
                          )}
                        </div>

                        <div className="w-2/3">
                          {(accounts || []).length > 0 && (
                            <TransactionFeed
                              transactions={(transactions || []).filter(
                                transaction => !selectedAccountId || transaction.account_id === selectedAccountId
                              )}
                              selectedAccountId={selectedAccountId}
                              onClearAccountFilter={() => setSelectedAccountId(null)}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {/* Budget Tab Content */}
                {activeTab === 'budget' && (
                  <div className="py-4">
                    <div className="grid grid-cols-1 gap-6">
                      {/* Monthly Overview Card */}
                      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-5">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-gray-800">Monthly Overview</h3>
                          <div className="flex space-x-2">
                            <select className="text-sm border border-gray-200 rounded-md px-2 py-1">
                              <option>April 2025</option>
                              <option>March 2025</option>
                              <option>February 2025</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600 mb-1">Monthly Income</p>
                            <h4 className="text-2xl font-bold text-green-600">$4,850</h4>
                            <div className="flex items-center mt-2">
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">+5.2% from last month</span>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600 mb-1">Monthly Expenses</p>
                            <h4 className="text-2xl font-bold text-purple-600">$3,240</h4>
                            <div className="flex items-center mt-2">
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">67% of income</span>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600 mb-1">Savings</p>
                            <h4 className="text-2xl font-bold text-blue-600">$1,610</h4>
                            <div className="flex items-center mt-2">
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">33% of income</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="relative h-5 bg-gray-100 rounded-full mb-2 overflow-hidden">
                          <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-300" style={{ width: '67%' }}></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>$0</span>
                          <span>Expenses: $3,240</span>
                          <span>Income: $4,850</span>
                        </div>
                      </div>
                      
                      {/* Spending by Category Card */}
                      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-5">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Spending by Category</h3>
                        
                        <div className="grid grid-cols-2 gap-6">
                          <div className="flex flex-col justify-center">
                            <div className="w-full h-48 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 p-4 flex justify-center items-center">
                              {/* This would be a pie chart in a real implementation */}
                              <div className="relative w-36 h-36 rounded-full" style={{ background: 'conic-gradient(#8b5cf6 0% 25%, #ec4899 25% 45%, #06b6d4 45% 60%, #8b5cf6 60% 75%, #0ea5e9 75% 100%)' }}>
                                <div className="absolute inset-[15%] bg-white rounded-full flex items-center justify-center">
                                  <span className="text-sm font-medium">12 Categories</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                              <div className="flex-1">
                                <div className="flex justify-between">
                                  <span className="text-sm font-medium">Housing</span>
                                  <span className="text-sm font-medium">$1,200</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                                  <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: '37%' }}></div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full bg-pink-500 mr-2"></div>
                              <div className="flex-1">
                                <div className="flex justify-between">
                                  <span className="text-sm font-medium">Food & Dining</span>
                                  <span className="text-sm font-medium">$650</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                                  <div className="bg-pink-500 h-1.5 rounded-full" style={{ width: '20%' }}></div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full bg-cyan-500 mr-2"></div>
                              <div className="flex-1">
                                <div className="flex justify-between">
                                  <span className="text-sm font-medium">Transportation</span>
                                  <span className="text-sm font-medium">$490</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                                  <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: '15%' }}></div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full bg-purple-400 mr-2"></div>
                              <div className="flex-1">
                                <div className="flex justify-between">
                                  <span className="text-sm font-medium">Entertainment</span>
                                  <span className="text-sm font-medium">$380</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                                  <div className="bg-purple-400 h-1.5 rounded-full" style={{ width: '12%' }}></div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                              <div className="flex-1">
                                <div className="flex justify-between">
                                  <span className="text-sm font-medium">Other</span>
                                  <span className="text-sm font-medium">$520</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '16%' }}></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Budget Progress Card */}
                      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-5">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-gray-800">Budget Progress</h3>
                          <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            Day 18 of 30
                          </div>
                        </div>
                        
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-sm">Food & Dining</span>
                              <div className="text-right">
                                <span className="text-sm font-bold">$650</span>
                                <span className="text-sm text-gray-500"> / $800</span>
                              </div>
                            </div>
                            <div className="relative h-3 bg-gray-100 rounded-full">
                              <div className="absolute top-0 left-0 h-full bg-pink-500 rounded-full" style={{ width: '81%' }}></div>
                              <div className="absolute top-0 h-full border-r-2 border-gray-600" style={{ left: '60%' }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>On pace: 60% should be spent by day 18</span>
                              <span className="text-red-600 font-medium">81% spent</span>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-sm">Entertainment</span>
                              <div className="text-right">
                                <span className="text-sm font-bold">$380</span>
                                <span className="text-sm text-gray-500"> / $500</span>
                              </div>
                            </div>
                            <div className="relative h-3 bg-gray-100 rounded-full">
                              <div className="absolute top-0 left-0 h-full bg-purple-400 rounded-full" style={{ width: '76%' }}></div>
                              <div className="absolute top-0 h-full border-r-2 border-gray-600" style={{ left: '60%' }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>On pace: 60% should be spent by day 18</span>
                              <span className="text-red-600 font-medium">76% spent</span>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-sm">Transportation</span>
                              <div className="text-right">
                                <span className="text-sm font-bold">$490</span>
                                <span className="text-sm text-gray-500"> / $900</span>
                              </div>
                            </div>
                            <div className="relative h-3 bg-gray-100 rounded-full">
                              <div className="absolute top-0 left-0 h-full bg-cyan-500 rounded-full" style={{ width: '54%' }}></div>
                              <div className="absolute top-0 h-full border-r-2 border-gray-600" style={{ left: '60%' }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>On pace: 60% should be spent by day 18</span>
                              <span className="text-green-600 font-medium">54% spent</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Insights and Recommendations Card */}
                      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-5">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Insights & Recommendations</h3>
                        
                        <div className="space-y-3">
                          <div className="flex p-3 bg-gradient-to-br from-pink-50 to-red-50 rounded-lg">
                            <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-red-100 text-red-600 rounded-full mr-3">
                              <span className="text-lg">⚠️</span>
                            </div>
                            <div>
                              <h4 className="font-medium text-red-700">Food & Dining over budget</h4>
                              <p className="text-sm text-gray-700 mt-1">You're spending too quickly on Food & Dining this month. At your current pace, you'll exceed your budget by $183 by month end.</p>
                            </div>
                          </div>
                          
                          <div className="flex p-3 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg">
                            <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-green-100 text-green-600 rounded-full mr-3">
                              <span className="text-lg">💰</span>
                            </div>
                            <div>
                              <h4 className="font-medium text-green-700">Savings on track</h4>
                              <p className="text-sm text-gray-700 mt-1">You're on pace to save $1,610 this month. This puts you $120 ahead of your monthly savings goal!</p>
                            </div>
                          </div>
                          
                          <div className="flex p-3 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg">
                            <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-purple-100 text-purple-600 rounded-full mr-3">
                              <span className="text-lg">💡</span>
                            </div>
                            <div>
                              <h4 className="font-medium text-purple-700">Recommendation</h4>
                              <p className="text-sm text-gray-700 mt-1">Consider reducing restaurant spending for the rest of the month. Home-cooked meals could help you stay under your Food & Dining budget.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {generatedText && (
                <div className="bg-white rounded-lg shadow p-6 mt-6">
                  <h2 className="text-xl font-semibold mb-4">Generated Text</h2>
                  <p>{generatedText}</p>
                </div>
              )}

              {(accounts || []).length > 0 && (
                <div className="fixed bottom-4 right-4">
                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-full p-4 shadow-lg transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </button>
                  <ChatDrawer
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                    transactions={transactions || []}
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
          <div className="flex items-center justify-center min-h-screen -mt-16">
            <div className="bg-gradient-to-br from-white via-purple-50 to-blue-50 p-8 rounded-lg shadow-lg max-w-md w-full">
              <div className="flex flex-col items-center space-y-6">
                <img
                  src="https://blog.krezzo.com/hs-fs/hubfs/Krezzo-Logo-2023-Light.png?width=3248&height=800&name=Krezzo-Logo-2023-Light.png"
                  alt="Krezzo Logo"
                  className="mb-4"
                  style={{ width: '150px', height: 'auto' }}
                />
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">Unlock your financial freedom</h2>
                <button 
                  onClick={signInWithGoogle}
                  className="w-full font-semibold px-6 py-3 rounded-lg shadow text-white bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sign up with Google
                </button>
                <div className="flex items-center space-x-2 w-full">
                  <div className="h-px flex-1 bg-gray-300"></div>
                  <span className="text-sm text-gray-500">or</span>
                  <div className="h-px flex-1 bg-gray-300"></div>
                </div>
                <button 
                  onClick={signInWithGoogle} 
                  className="w-full border border-purple-200 bg-white py-2 px-6 rounded-lg hover:bg-purple-50 transition-colors font-medium"
                >
                  Sign in with Google
                </button>
                <p className="text-sm text-gray-500 mt-4 text-center">
                  By signing up, you agree to our{' '}
                  <Link to="/terms-of-service" className="text-purple-600 hover:text-purple-800">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy-policy" className="text-purple-600 hover:text-purple-800">
                    Privacy Policy
                  </Link>
                </p>
              </div>
            </div>
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

// Also add TypeScript declaration for the global property
declare global {
  interface Window {
    clearAccountFilter: () => void;
  }
}

export default App;
