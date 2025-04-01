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
import { getApiUrl, logApiConfig } from './utils/apiConfig';
import { getPlaidConfig } from './config/plaid';

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

// Add this before the App component declaration
window.clearAccountFilter = () => {
  // This will be set properly inside the component
};

// Define types for budget calculations
interface MonthlyMetrics {
  income: number;
  expenses: number;
  savings: number;
  expensePercentage: number;
  savingsPercentage: number;
}

interface CategoryData {
  total: number;
  transactions: Transaction[];
}

interface CategorySpending {
  name: string;
  totalSpent: number;
  currentMonthSpent: number;
  transactionCount: number;
  percentage: number;
  historicalAvgSpend: number;
  recentTrendSpend: number;
  adaptiveBudget: number;
  trendPercentage: number; // +/- percentage showing change in spending habits
}

interface BudgetProgress {
  name: string;
  spent: number;
  budget: number;
  adaptiveBudget: number;
  historicalAverage: number;
  spentPercentage: number;
  adaptivePercentage: number;
  expectedSpendingPercentage: number;
  isOverPace: boolean;
  isUnderPace: boolean;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
}

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
  const [activeTab, setActiveTab] = useState<'account' | 'budget' | 'roadmap'>('account');
  
  // Add state for selected month and year
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const plaidConfig = getPlaidConfig();

  // Add helper functions for budget calculations
  const calculateMonthlyMetrics = (): MonthlyMetrics | null => {
    if (!transactions.length) return null;
    
    // Use the selected month and year instead of current date
    const targetMonth = selectedMonth;
    const targetYear = selectedYear;
    
    // Filter for selected month transactions
    const currentMonthTransactions = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate.getMonth() === targetMonth && txDate.getFullYear() === targetYear;
    });
    
    // Calculate income (negative amounts in transactions are income)
    const incomeTransactions = currentMonthTransactions.filter(t => t.amount < 0);
    const monthlyIncome = Math.abs(incomeTransactions.reduce((sum, t) => sum + t.amount, 0));
    
    // Calculate expenses (positive amounts are expenses)
    const expenseTransactions = currentMonthTransactions.filter(t => t.amount > 0);
    const monthlyExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate savings
    const monthlySavings = Math.max(0, monthlyIncome - monthlyExpenses);
    
    // Calculate percentage of income
    const expensePercentage = monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 0;
    const savingsPercentage = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
    
    return {
      income: monthlyIncome,
      expenses: monthlyExpenses,
      savings: monthlySavings,
      expensePercentage,
      savingsPercentage
    };
  };

  const calculateCategorySpending = (): CategorySpending[] => {
    if (!transactions.length) return [];
    
    // Use the selected month and year instead of current date
    const targetMonth = selectedMonth;
    const targetYear = selectedYear;
    
    // Get all expense transactions AND payment transactions
    // Include both expense (positive amount) and payment (negative amount) transactions
    const allTransactions = transactions;
    
    // Group by category
    const categories = new Map<string, CategoryData>();
    
    allTransactions.forEach(t => {
      // Skip transfers between accounts which shouldn't be part of budget
      if (t.category && t.category.includes('Transfer')) return;
      
      // Skip income transactions (negative amounts)
      if (t.amount < 0) return;
      
      const category = t.category && t.category.length > 0 ? t.category[0] : 'Uncategorized';
      
      if (!categories.has(category)) {
        categories.set(category, { total: 0, transactions: [] });
      }
      const categoryData = categories.get(category) as CategoryData;
      categoryData.total += Math.abs(t.amount); // Use absolute value
      categoryData.transactions.push(t);
      categories.set(category, categoryData);
    });
    
    // Convert to array and sort by total amount
    const categoryArray = Array.from(categories.entries()).map(([name, data]) => {
      // Get current month data
      const currentMonthTransactions = data.transactions.filter((t: Transaction) => {
        const txDate = new Date(t.date);
        return txDate.getMonth() === targetMonth && txDate.getFullYear() === targetYear;
      });
      
      const currentMonthTotal = currentMonthTransactions.reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);
      
      // Calculate historical monthly averages
      const txDates = data.transactions.map(t => new Date(t.date));
      const oldestDate = new Date(Math.min(...txDates.map(d => d.getTime())));
      
      // Calculate months between oldest transaction and now
      const now = new Date();
      const monthsDiff = (now.getMonth() - oldestDate.getMonth()) + 
                        (12 * (now.getFullYear() - oldestDate.getFullYear()));
      
      // Ensure at least 1 month to avoid division by zero
      const monthsSpan = Math.max(1, monthsDiff);
      
      // Historical average monthly spend
      const historicalAvgSpend = data.total / monthsSpan;
      
      // Calculate recent trend (last 3 months)
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const recentTransactions = data.transactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate >= threeMonthsAgo;
      });
      
      // Calculate recent monthly average
      const recentTotal = recentTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const recentMonths = Math.min(3, monthsSpan);
      const recentTrendSpend = recentTotal / recentMonths;
      
      // Calculate adaptive budget - weights recent trends more heavily
      // 70% recent trend, 30% historical average if we have at least 3 months of data
      // Otherwise more weight to historical as we have less recent data
      const recentWeight = Math.min(0.7, recentMonths / 4); // Scales from 0.25 to 0.7 max
      const historicalWeight = 1 - recentWeight;
      
      const adaptiveBudget = (recentTrendSpend * recentWeight) + (historicalAvgSpend * historicalWeight);
      
      // Calculate trend percentage (how much is spending trending up or down)
      const trendPercentage = historicalAvgSpend > 0 
        ? ((recentTrendSpend - historicalAvgSpend) / historicalAvgSpend) * 100 
        : 0;
      
      return {
        name,
        totalSpent: data.total,
        currentMonthSpent: currentMonthTotal,
        transactionCount: data.transactions.length,
        historicalAvgSpend,
        recentTrendSpend,
        adaptiveBudget,
        trendPercentage,
        percentage: 0 // Will calculate after we get totals
      };
    }).sort((a, b) => b.currentMonthSpent - a.currentMonthSpent);
    
    // Calculate percentage of total spending for each category
    const totalSpending = categoryArray.reduce((sum, cat) => sum + cat.currentMonthSpent, 0);
    
    return categoryArray.map(category => ({
      ...category,
      percentage: totalSpending > 0 ? (category.currentMonthSpent / totalSpending) * 100 : 0
    }));
  };

  const calculateBudgetProgress = (): BudgetProgress[] => {
    if (!transactions.length) return [];
    
    // Use the selected month and year instead of current date
    const targetMonth = selectedMonth;
    const targetYear = selectedYear;
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const now = new Date();
    
    // For past months, use the full month. For current month, use current day.
    const isCurrentMonth = now.getMonth() === targetMonth && now.getFullYear() === targetYear;
    const daysPassed = isCurrentMonth ? now.getDate() : daysInMonth;
    
    // Calculate expected spending percentage
    const expectedSpendingPercentage = (daysPassed / daysInMonth) * 100;
    
    // Get category data with adaptive budgets
    const categories = calculateCategorySpending();
    
    // Set up basic budget limits as a fallback
    const defaultBudgets: Record<string, number> = {
      'Food and Drink': 800,
      'Travel': 500,
      'Entertainment': 400,
      'Shopping': 600,
      'Transportation': 900
    };
    
    // Create a record of adaptive budgets
    const adaptiveBudgets: Record<string, number> = {};
    
    // Fill adaptive budgets from our calculations
    categories.forEach(category => {
      adaptiveBudgets[category.name] = category.adaptiveBudget;
    });
    
    // Include all categories with a valid budget, even if no spending yet this month
    return categories
      .filter(cat => (adaptiveBudgets[cat.name] || defaultBudgets[cat.name] || 0) > 0)
      .map(category => {
        // Use the adaptive budget or fall back to default
        const adaptiveBudget = adaptiveBudgets[category.name] || 0;
        const fallbackBudget = defaultBudgets[category.name] || 0;
        
        // If we have an adaptive budget use it, otherwise fall back to default
        const budget = adaptiveBudget > 0 ? adaptiveBudget : fallbackBudget;
        
        // Calculate percentages
        const spentPercentage = (category.currentMonthSpent / budget) * 100;
        const adaptivePercentage = adaptiveBudget > 0 ? (category.currentMonthSpent / adaptiveBudget) * 100 : 0;
        
        // Determine pace
        const isOverPace = spentPercentage > expectedSpendingPercentage * 1.1; // 10% over expected pace
        const isUnderPace = spentPercentage < expectedSpendingPercentage * 0.9; // 10% under expected pace
        
        // Determine trend direction
        let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (category.trendPercentage > 5) trendDirection = 'increasing';
        else if (category.trendPercentage < -5) trendDirection = 'decreasing';
        
        return {
          name: category.name,
          spent: category.currentMonthSpent,
          budget: budget,
          adaptiveBudget: adaptiveBudget,
          historicalAverage: category.historicalAvgSpend,
          spentPercentage,
          adaptivePercentage,
          expectedSpendingPercentage,
          isOverPace,
          isUnderPace,
          trendDirection,
          trendPercentage: category.trendPercentage
        };
      })
      .sort((a, b) => b.adaptiveBudget - a.adaptiveBudget); // Sort by historical adaptive budget amounts (highest to lowest)
  };

  // Add helper functions for date selection
  // Get array of month names
  const getMonthNames = (): string[] => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      months.push(new Date(2000, i, 1).toLocaleString('default', { month: 'long' }));
    }
    return months;
  };
  
  // Get array of available years (from oldest transaction to current year)
  const getAvailableYears = (): number[] => {
    if (!transactions.length) return [currentDate.getFullYear()];
    
    const years = new Set<number>();
    const currentYear = currentDate.getFullYear();
    
    // Add current year and previous year by default
    years.add(currentYear);
    years.add(currentYear - 1);
    
    // Add all years from transactions
    transactions.forEach(t => {
      const txDate = new Date(t.date);
      years.add(txDate.getFullYear());
    });
    
    return Array.from(years).sort((a, b) => b - a); // Sort descending
  };

  // Handle month change
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(parseInt(e.target.value));
  };
  
  // Handle year change
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedYear(parseInt(e.target.value));
  };

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
        const response = await fetch(getApiUrl('create-link-token'), {
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
      // In development, try to get stored token from localStorage
      let payload: { userId: string; accessToken?: string } = { userId: user.uid };
      
      if (process.env.NODE_ENV !== 'production') {
        const storedToken = localStorage.getItem(`plaid_access_token_${user.uid}`);
        if (storedToken) {
          console.log('Using stored access token from localStorage');
          payload.accessToken = storedToken;
        }
      }
      
      const response = await fetch(getApiUrl('transactions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setTransactions(data.transactions);
      setAccounts(data.accounts);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    }
  };

  // Plaid handlers
  const handlePlaidSuccess = async (public_token: string) => {
    console.log('Success getting public token');
    setIsLoading(true);
    setError(null);
    
    try {
      // Exchange public token for access token
      const userId = user?.uid;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const apiUrl = getApiUrl('exchange-token');
      const response = await fetch(`${apiUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          publicToken: public_token,
          userId 
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('Successfully exchanged token');
        setHasCompletedOnboarding(true);
        await fetchTransactions();
      } else {
        throw new Error(data.error || 'Failed to exchange token');
      }
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePlaidExit = (err: PlaidLinkError | null) => {
    if (err) {
      console.error('Plaid Link exit with error:', err);
      setError(err.display_message || err.error_message || 'Error connecting to bank');
    }
  };
  
  const handlePlaidEvent = (eventName: string, metadata: any) => {
    console.log('Plaid event:', eventName, metadata);
  };
  
  const handlePlaidReady = () => {
    console.log('Plaid Link is ready');
  };
  
  // Then use these handlers in the usePlaidLink hook
  const { open, ready } = usePlaidLink({
    token: linkToken || '',
    onSuccess: handlePlaidSuccess,
    onExit: handlePlaidExit,
    onEvent: handlePlaidEvent,
    // Use only officially supported properties
    product: ['transactions'],
    language: 'en',
    countryCodes: ['US'],
    env: plaidConfig.env as any, // Use type assertion to resolve string/number issue
  });

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
                    <button
                      className={`py-2 px-4 font-medium text-sm focus:outline-none ${
                        activeTab === 'roadmap'
                          ? 'text-purple-600 border-b-2 border-purple-500'
                          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() => setActiveTab('roadmap')}
                    >
                      Roadmap
                    </button>
                  </div>
                </div>
                
                {/* Account Data Tab Content */}
                {activeTab === 'account' && (
                  <div className="py-6 min-h-[70vh]">
                    {isLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading...</p>
                      </div>
                    ) : (accounts?.length || 0) === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-600">Connect an account to see your financial data.</p>
                        <button
                          onClick={() => ready && open()}
                          disabled={!ready || !linkToken || isLoading}
                          className="mt-4 font-semibold px-6 py-3 rounded-lg shadow text-white bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Connect Your Bank Account
                        </button>
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

                    {error && (
                      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4">
                        <span className="block sm:inline">{error}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Budget Tab Content */}
                {activeTab === 'budget' && (
                  <div className="py-6 min-h-[70vh]">
                    {isLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading budget data...</p>
                      </div>
                    ) : transactions.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-600">Connect an account to see your budget analysis.</p>
                        <button
                          onClick={() => ready && open()}
                          disabled={!ready || !linkToken}
                          className="mt-4 font-semibold px-6 py-3 rounded-lg shadow text-white bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Connect Your Bank Account
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-6">
                        {/* Add Date Selector */}
                        <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-800">Budget Period</h3>
                            <div className="flex space-x-4">
                              <div className="relative">
                                <select
                                  value={selectedMonth}
                                  onChange={handleMonthChange}
                                  className="appearance-none block w-full bg-white border border-gray-300 rounded-md py-2 pl-3 pr-10 text-base focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer"
                                >
                                  {getMonthNames().map((month, index) => (
                                    <option key={index} value={index}>
                                      {month}
                                    </option>
                                  ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                              <div className="relative">
                                <select
                                  value={selectedYear}
                                  onChange={handleYearChange}
                                  className="appearance-none block w-full bg-white border border-gray-300 rounded-md py-2 pl-3 pr-10 text-base focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer"
                                >
                                  {getAvailableYears().map(year => (
                                    <option key={year} value={year}>
                                      {year}
                                    </option>
                                  ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                              <button 
                                onClick={() => {
                                  setSelectedMonth(currentDate.getMonth());
                                  setSelectedYear(currentDate.getFullYear());
                                }}
                                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition"
                              >
                                Current Month
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Monthly Overview Card - Using actual transaction data */}
                        {(() => {
                          const monthlyMetrics = calculateMonthlyMetrics();
                          if (!monthlyMetrics) return null;
                          
                          const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString('default', { month: 'long' });
                          const year = selectedYear;
                          
                          return (
                            <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-5">
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">Monthly Overview</h3>
                                <div className="flex space-x-2">
                                  <div className="text-sm border border-gray-200 rounded-md px-2 py-1">
                                    {monthName} {year}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4">
                                  <p className="text-sm text-gray-600 mb-1">Monthly Income</p>
                                  <h4 className="text-2xl font-bold text-green-600">${Math.round(monthlyMetrics.income)}</h4>
                                  <div className="flex items-center mt-2">
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                      {accounts.length} connected {accounts.length === 1 ? 'account' : 'accounts'}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4">
                                  <p className="text-sm text-gray-600 mb-1">Monthly Expenses</p>
                                  <h4 className="text-2xl font-bold text-purple-600">${Math.round(monthlyMetrics.expenses)}</h4>
                                  <div className="flex items-center mt-2">
                                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                      {monthlyMetrics.expensePercentage.toFixed(0)}% of income
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4">
                                  <p className="text-sm text-gray-600 mb-1">Avg. Monthly Spend</p>
                                  <h4 className="text-2xl font-bold text-blue-600">
                                    ${(() => {
                                      // Calculate total adaptive budget for the month
                                      const categories = calculateCategorySpending();
                                      const totalAdaptiveBudget = categories.reduce((sum, cat) => sum + cat.adaptiveBudget, 0);
                                      return Math.round(totalAdaptiveBudget);
                                    })()}
                                  </h4>
                                  <div className="flex items-center mt-2">
                                    {(() => {
                                      const categories = calculateCategorySpending();
                                      const totalAdaptiveBudget = categories.reduce((sum, cat) => sum + cat.adaptiveBudget, 0);
                                      const budgetPercentage = totalAdaptiveBudget > 0 
                                        ? (monthlyMetrics.expenses / totalAdaptiveBudget) * 100
                                        : 0;
                                      const isOverBudget = budgetPercentage > 100;
                                      const isUnderBudget = budgetPercentage < 85;
                                      
                                      return (
                                        <span className={`text-xs ${
                                          isOverBudget ? 'bg-red-100 text-red-800' : 
                                          isUnderBudget ? 'bg-green-100 text-green-800' : 
                                          'bg-blue-100 text-blue-800'
                                        } px-2 py-0.5 rounded-full`}>
                                          {budgetPercentage.toFixed(0)}% used
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="relative h-5 bg-gray-100 rounded-full mb-2 overflow-hidden">
                                {(() => {
                                  const categories = calculateCategorySpending();
                                  const totalAdaptiveBudget = categories.reduce((sum, cat) => sum + cat.adaptiveBudget, 0);
                                  const budgetPercentage = totalAdaptiveBudget > 0 
                                    ? (monthlyMetrics.expenses / totalAdaptiveBudget) * 100
                                    : 0;
                                  const isOverBudget = budgetPercentage > 100;
                                  
                                  return (
                                    <div 
                                      className={`absolute left-0 top-0 h-full ${
                                        isOverBudget 
                                          ? 'bg-gradient-to-r from-red-500 via-red-400 to-red-300' 
                                          : 'bg-gradient-to-r from-purple-500 via-pink-500 to-purple-300'
                                      }`} 
                                      style={{ width: `${Math.min(100, budgetPercentage)}%` }}
                                    ></div>
                                  );
                                })()}
                                
                                <div 
                                  className="absolute top-0 h-full border-r-2 border-gray-800"
                                  style={{ 
                                    left: `${(() => {
                                      // Calculate expected spending percentage based on days passed in month
                                      const now = new Date();
                                      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                                      const daysPassed = now.getDate();
                                      return (daysPassed / daysInMonth) * 100;
                                    })()}%`,
                                    opacity: 0.7
                                  }}
                                ></div>
                              </div>
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>$0</span>
                                <span>
                                  {(() => {
                                    const categories = calculateCategorySpending();
                                    const totalAdaptiveBudget = categories.reduce((sum, cat) => sum + cat.adaptiveBudget, 0);
                                    return `Budget: $${totalAdaptiveBudget.toFixed(2)}`;
                                  })()}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Spending by Category Card - Using real categories */}
                        {(() => {
                          const categories = calculateCategorySpending();
                          if (!categories.length) return null;
                          
                          // Get top 5 categories for the display
                          const topCategories = categories.slice(0, 5);
                          
                          // Calculate total for pie chart
                          const totalSpending = categories.reduce((sum, cat) => sum + cat.currentMonthSpent, 0);
                          
                          // Get month name for display
                          const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString('default', { month: 'long' });
                          
                          return (
                            <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-5">
                              <h3 className="text-lg font-semibold text-gray-800 mb-4">Spending by Category - {monthName} {selectedYear}</h3>
                              
                              <div className="grid grid-cols-2 gap-6">
                                <div className="flex flex-col justify-center">
                                  <div className="w-full h-48 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 p-4 flex justify-center items-center">
                                    {/* Pie chart visualization based on real data */}
                                    <div 
                                      className="relative w-36 h-36 rounded-full" 
                                      style={{ background: `conic-gradient(
                                        #8b5cf6 0% ${Math.min(100, topCategories[0]?.percentage || 0)}%, 
                                        #ec4899 ${Math.min(100, topCategories[0]?.percentage || 0)}% ${Math.min(100, (topCategories[0]?.percentage || 0) + (topCategories[1]?.percentage || 0))}%, 
                                        #06b6d4 ${Math.min(100, (topCategories[0]?.percentage || 0) + (topCategories[1]?.percentage || 0))}% ${Math.min(100, (topCategories[0]?.percentage || 0) + (topCategories[1]?.percentage || 0) + (topCategories[2]?.percentage || 0))}%, 
                                        #8b5cf6 ${Math.min(100, (topCategories[0]?.percentage || 0) + (topCategories[1]?.percentage || 0) + (topCategories[2]?.percentage || 0))}% ${Math.min(100, (topCategories[0]?.percentage || 0) + (topCategories[1]?.percentage || 0) + (topCategories[2]?.percentage || 0) + (topCategories[3]?.percentage || 0))}%, 
                                        #0ea5e9 ${Math.min(100, (topCategories[0]?.percentage || 0) + (topCategories[1]?.percentage || 0) + (topCategories[2]?.percentage || 0) + (topCategories[3]?.percentage || 0))}% 100%
                                      )` }}
                                    >
                                      <div className="absolute inset-[15%] bg-white rounded-full flex items-center justify-center">
                                        <span className="text-sm font-medium">{categories.length} Categories</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="space-y-3">
                                  {/* Map through top 5 categories */}
                                  {topCategories.map((category, index) => {
                                    // Color array for consistency with pie chart
                                    const colors = ['bg-purple-500', 'bg-pink-500', 'bg-cyan-500', 'bg-purple-400', 'bg-blue-500'];
                                    const colorClass = colors[index % colors.length];
                                    
                                    return (
                                      <div className="flex items-center" key={category.name}>
                                        <div className={`w-3 h-3 rounded-full ${colorClass} mr-2`}></div>
                                        <div className="flex-1">
                                          <div className="flex justify-between">
                                            <span className="text-sm font-medium">{category.name}</span>
                                            <span className="text-sm font-medium">${category.currentMonthSpent.toFixed(2)}</span>
                                          </div>
                                          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                                            <div 
                                              className={colorClass + " h-1.5 rounded-full"} 
                                              style={{ width: `${Math.min(100, Math.abs(category.percentage))}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Budget Progress Card - Using real spending data */}
                        {(() => {
                          const budgetProgress = calculateBudgetProgress();
                          if (!budgetProgress.length) return null;
                          
                          // Date information for context
                          const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
                          const now = new Date();
                          
                          // For past months, use the full month. For current month, use current day.
                          const isCurrentMonth = now.getMonth() === selectedMonth && now.getFullYear() === selectedYear;
                          const daysPassed = isCurrentMonth ? now.getDate() : daysInMonth;
                          
                          // Get month name for display
                          const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString('default', { month: 'long' });
                          const isHistorical = selectedYear < now.getFullYear() || 
                                              (selectedYear === now.getFullYear() && selectedMonth < now.getMonth());
                          
                          return (
                            <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-5">
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">
                                  {isHistorical ? `${monthName} ${selectedYear} Budget (Historical)` : "Dynamic Budget"}
                                </h3>
                                <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                  {isHistorical ? "Full Month" : `Day ${daysPassed} of ${daysInMonth}`}
                                </div>
                              </div>
                              
                              <div className="space-y-5 max-h-[600px] overflow-y-auto pr-2">
                                {budgetProgress.map(category => {
                                  // Calculate more accurate projections
                                  const daysRemaining = daysInMonth - daysPassed;
                                  const dailySpendRate = category.spent / Math.max(1, daysPassed); // Avoid division by zero
                                  const projectedAdditionalSpend = dailySpendRate * daysRemaining;
                                  const projectedTotalSpend = category.spent + projectedAdditionalSpend;
                                  const projectedPercentOfBudget = (projectedTotalSpend / category.adaptiveBudget) * 100;
                                  
                                  return (
                                  <div className="space-y-2" key={category.name}>
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center">
                                        <span className="font-medium text-sm">{category.name}</span>
                                        {category.trendDirection !== 'stable' && (
                                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                                            category.trendDirection === 'increasing' 
                                              ? 'bg-yellow-100 text-yellow-800' 
                                              : 'bg-green-100 text-green-800'
                                          }`}>
                                            {category.trendDirection === 'increasing' 
                                              ? `↑ ${Math.abs(category.trendPercentage).toFixed(0)}%` 
                                              : `↓ ${Math.abs(category.trendPercentage).toFixed(0)}%`}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span className="text-sm font-bold">${category.spent.toFixed(0)}</span>
                                        <span className="text-sm text-gray-500"> / ${category.adaptiveBudget.toFixed(0)}</span>
                                      </div>
                                    </div>
                                    
                                    {/* Main progress bar with dual colors: actual and projected */}
                                    <div className="relative h-3 bg-gray-100 rounded-full">
                                      {/* Actual spend portion - only show if there is spending */}
                                      {category.spent > 0 && (
                                        <div 
                                          className={`absolute top-0 left-0 h-full rounded-l-full ${
                                            category.isOverPace ? 'bg-red-500' : category.isUnderPace ? 'bg-green-500' : 'bg-blue-500'
                                          }`}
                                          style={{ width: `${Math.min(100, category.spentPercentage)}%` }}
                                        ></div>
                                      )}
                                      
                                      {/* Projected additional spend portion - only show if there is spending and not historical */}
                                      {!isHistorical && category.spent > 0 && (
                                        <div 
                                          className={`absolute top-0 h-full ${
                                            category.isOverPace ? 'bg-red-300' : category.isUnderPace ? 'bg-green-300' : 'bg-blue-300'
                                          }`}
                                          style={{ 
                                            left: `${Math.min(100, category.spentPercentage)}%`, 
                                            width: `${Math.min(100 - Math.min(100, category.spentPercentage), Math.min(100, projectedPercentOfBudget) - Math.min(100, category.spentPercentage))}%`,
                                            borderTopRightRadius: projectedPercentOfBudget >= 100 ? '0.375rem' : '0',
                                            borderBottomRightRadius: projectedPercentOfBudget >= 100 ? '0.375rem' : '0'
                                          }}
                                        ></div>
                                      )}
                                      
                                      {/* Only show expected pace marker if not historical */}
                                      {!isHistorical && (
                                        <div 
                                          className="absolute top-0 h-full border-r-2 border-gray-600"
                                          style={{ left: `${category.expectedSpendingPercentage}%` }}
                                        ></div>
                                      )}
                                    </div>
                                    
                                    <div className="flex justify-between text-xs text-gray-500">
                                      {category.spent > 0 ? (
                                        <span className={category.isOverPace ? 'text-red-600 font-medium' : category.isUnderPace ? 'text-green-600 font-medium' : 'text-gray-600'}>
                                          {category.spentPercentage.toFixed(0)}% spent
                                        </span>
                                      ) : (
                                        <span className="text-gray-600">
                                          No spending yet
                                        </span>
                                      )}
                                      
                                      {!isHistorical && category.spent > 0 ? (
                                        <span>
                                          Projected: ${projectedTotalSpend.toFixed(0)} by month end
                                        </span>
                                      ) : (
                                        <span>
                                          Budget: ${category.adaptiveBudget.toFixed(0)} available
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Only show rate details if there's actual spending and not historical */}
                                    {!isHistorical && category.spent > 0 && (
                                      <div className="bg-gray-50 p-2 rounded text-xs mt-1">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Daily Rate:</span>
                                          <span className="font-medium">${dailySpendRate.toFixed(2)}/day</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )})}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Roadmap Tab Content */}
                {activeTab === 'roadmap' && (
                  <div className="py-6 min-h-[70vh]">
                    <div className="grid grid-cols-1 gap-6">
                      {/* Introduction Card */}
                      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-5">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-gray-800">Product Development Roadmap</h3>
                          <div className="flex space-x-2">
                            <div className="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                              Updated {new Date().toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-600 mb-4">This roadmap outlines our prioritized development initiatives to enhance the product based on comprehensive codebase analysis.</p>
                        
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 flex items-center">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white mr-3">
                              <span className="text-xl font-bold">1</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Current Sprint</p>
                              <p className="text-lg font-bold text-purple-700">Architecture Refactoring</p>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 flex items-center">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 flex items-center justify-center text-white mr-3 opacity-80">
                              <span className="text-xl font-bold">2</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Next Sprint</p>
                              <p className="text-lg font-bold text-purple-700">Comprehensive Error Handling</p>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 flex items-center">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center justify-center text-white mr-3 opacity-70">
                              <span className="text-xl font-bold">3</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Future Sprint</p>
                              <p className="text-lg font-bold text-purple-700">Mobile Responsiveness</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="relative h-2 bg-gray-100 rounded-full mb-4">
                          <div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500" style={{ width: '25%' }}></div>
                          <div className="absolute left-[25%] top-[-8px] h-4 w-4 rounded-full bg-white border-2 border-purple-600"></div>
                        </div>
                        
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Initial Planning</span>
                          <span>Development</span>
                          <span>Testing</span>
                          <span>Deployment</span>
                        </div>
                      </div>
                      
                      {/* Priority 1: Architecture Refactoring */}
                      <div className="bg-white rounded-xl shadow-sm border-l-4 border-purple-500 border-t border-r border-b p-5">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center">
                            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 mr-4">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                              </svg>
                            </div>
                            <div>
                              <div className="flex items-center">
                                <h3 className="text-xl font-bold text-gray-800">Architecture Refactoring</h3>
                                <span className="ml-3 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">HIGH PRIORITY</span>
                              </div>
                              <p className="text-gray-600">Decomposing the monolithic App.tsx into maintainable components</p>
                            </div>
                          </div>
                          <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center relative">
                            <div className="w-16 h-16 rounded-full bg-purple-200" style={{ position: 'absolute', opacity: 0.7 }}></div>
                            <div className="w-14 h-14 rounded-full bg-pink-200" style={{ position: 'absolute', left: '20px', top: '30px', opacity: 0.7 }}></div>
                            <div className="w-10 h-10 rounded-full bg-blue-200" style={{ position: 'absolute', left: '40px', top: '20px', opacity: 0.7 }}></div>
                            <div className="z-10 text-gray-800 font-semibold text-sm">Components</div>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">Progress</span>
                            <span className="text-sm font-medium text-purple-700">15%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full">
                            <div className="h-2 bg-purple-600 rounded-full" style={{ width: '15%' }}></div>
                          </div>
                        </div>
                        
                        <div className="border border-gray-200 rounded-lg p-4 mb-4">
                          <h4 className="font-semibold text-gray-800 mb-2">Key Deliverables</h4>
                          <ul className="space-y-2">
                            <li className="flex items-start">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-purple-500 flex items-center justify-center mr-2 mt-0.5">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              </div>
                              <span className="text-sm text-gray-700">Component Directory Structure</span>
                            </li>
                            <li className="flex items-start">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-purple-500 flex items-center justify-center mr-2 mt-0.5">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              </div>
                              <span className="text-sm text-gray-700">State Management Restructuring</span>
                            </li>
                            <li className="flex items-start">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-purple-500 flex items-center justify-center mr-2 mt-0.5">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              </div>
                              <span className="text-sm text-gray-700">Business Logic Separation</span>
                            </li>
                            <li className="flex items-start">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-purple-500 flex items-center justify-center mr-2 mt-0.5">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              </div>
                              <span className="text-sm text-gray-700">Routing Enhancement</span>
                            </li>
                          </ul>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">Code Quality</span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Maintainability</span>
                          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs">Performance</span>
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Scalability</span>
                        </div>
                      </div>
                      
                      {/* Priority 2: Error Handling */}
                      <div className="bg-white rounded-xl shadow-sm border-l-4 border-pink-500 border-t border-r border-b p-5">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center">
                            <div className="w-12 h-12 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600 mr-4">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div>
                              <div className="flex items-center">
                                <h3 className="text-xl font-bold text-gray-800">Error Handling System</h3>
                                <span className="ml-3 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">MEDIUM PRIORITY</span>
                              </div>
                              <p className="text-gray-600">Comprehensive error handling and user feedback system</p>
                            </div>
                          </div>
                          <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center relative">
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg className="h-16 w-16 text-pink-300" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-18c4.411 0 8 3.589 8 8s-3.589 8-8 8-8-3.589-8-8 3.589-8 8-8zm0 13a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0-10a1 1 0 00-1 1v5a1 1 0 002 0V8a1 1 0 00-1-1z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">Progress</span>
                            <span className="text-sm font-medium text-pink-700">8%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full">
                            <div className="h-2 bg-pink-500 rounded-full" style={{ width: '8%' }}></div>
                          </div>
                        </div>
                        
                        <div className="border border-gray-200 rounded-lg p-4 mb-4">
                          <h4 className="font-semibold text-gray-800 mb-2">Key Deliverables</h4>
                          <ul className="space-y-2">
                            <li className="flex items-start">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-pink-500 flex items-center justify-center mr-2 mt-0.5">
                                <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                              </div>
                              <span className="text-sm text-gray-700">Global Error Boundary</span>
                            </li>
                            <li className="flex items-start">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-pink-500 flex items-center justify-center mr-2 mt-0.5">
                                <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                              </div>
                              <span className="text-sm text-gray-700">Standardized Error Handling</span>
                            </li>
                            <li className="flex items-start">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-pink-500 flex items-center justify-center mr-2 mt-0.5">
                                <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                              </div>
                              <span className="text-sm text-gray-700">User Feedback System</span>
                            </li>
                            <li className="flex items-start">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-pink-500 flex items-center justify-center mr-2 mt-0.5">
                                <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                              </div>
                              <span className="text-sm text-gray-700">Error Monitoring and Reporting</span>
                            </li>
                          </ul>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">User Experience</span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Error Prevention</span>
                          <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs">Reliability</span>
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs">Monitoring</span>
                        </div>
                      </div>
                      
                      {/* Priority 3: Mobile Responsiveness */}
                      <div className="bg-white rounded-xl shadow-sm border-l-4 border-blue-500 border-t border-r border-b p-5">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center">
                            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 mr-4">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <div className="flex items-center">
                                <h3 className="text-xl font-bold text-gray-800">Mobile Responsiveness</h3>
                                <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">STANDARD PRIORITY</span>
                              </div>
                              <p className="text-gray-600">Enhanced mobile experience across all devices</p>
                            </div>
                          </div>
                          <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                            <div className="flex items-center justify-center space-x-1">
                              <div className="h-16 w-6 rounded-md border-2 border-blue-400"></div>
                              <div className="h-14 w-10 rounded-md border-2 border-blue-400"></div>
                              <div className="h-12 w-16 rounded-md border-2 border-blue-400"></div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">Progress</span>
                            <span className="text-sm font-medium text-blue-700">2%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full">
                            <div className="h-2 bg-blue-500 rounded-full" style={{ width: '2%' }}></div>
                          </div>
                        </div>
                        
                        <div className="border border-gray-200 rounded-lg p-4 mb-4">
                          <h4 className="font-semibold text-gray-800 mb-2">Key Deliverables</h4>
                          <ul className="space-y-2">
                            <li className="flex items-start">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center mr-2 mt-0.5">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              </div>
                              <span className="text-sm text-gray-700">Responsive Layout System</span>
                            </li>
                            <li className="flex items-start">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center mr-2 mt-0.5">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              </div>
                              <span className="text-sm text-gray-700">Touch-Friendly Interactions</span>
                            </li>
                            <li className="flex items-start">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center mr-2 mt-0.5">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              </div>
                              <span className="text-sm text-gray-700">Mobile-Specific UI Optimizations</span>
                            </li>
                            <li className="flex items-start">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center mr-2 mt-0.5">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              </div>
                              <span className="text-sm text-gray-700">Progressive Enhancement</span>
                            </li>
                          </ul>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">User Experience</span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Accessibility</span>
                          <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-xs">Device Compatibility</span>
                          <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">Performance</span>
                        </div>
                      </div>
                      
                      {/* Additional Features Section */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Feature Requests & Additional Initiatives</h3>
                        
                        <div className="overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feature</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              <tr>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">Credit Card Transaction Sign Convention Fix</div>
                                  <div className="text-sm text-gray-500">Correct handling of transaction amounts based on account type</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">High</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">In Planning</span>
                                </td>
                              </tr>
                              <tr>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">Domain Migration to Krezzo.com</div>
                                  <div className="text-sm text-gray-500">Migrating from current Netlify domain to Krezzo.com domain</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Medium</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Not Started</span>
                                </td>
                              </tr>
                              <tr>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">Enhanced Authentication Token Management</div>
                                  <div className="text-sm text-gray-500">Improved token persistence and refresh mechanisms</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Medium</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Research</span>
                                </td>
                              </tr>
                              <tr>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">Custom Budget Categories</div>
                                  <div className="text-sm text-gray-500">User-defined budget categories and allocation</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Low</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Backlog</span>
                                </td>
                              </tr>
                              <tr>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">Financial Goal Setting</div>
                                  <div className="text-sm text-gray-500">Set, track, and visualize financial goals</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Low</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Idea</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
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
