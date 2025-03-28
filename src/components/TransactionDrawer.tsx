import React, { useState, useEffect } from 'react';
import { Transaction } from '../plaid';
import ReactMarkdown from 'react-markdown';

const API_URL = `${import.meta.env.VITE_API_URL}/api` || 'http://localhost:5176/api';

interface TransactionDrawerProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
}

const TransactionDrawer: React.FC<TransactionDrawerProps> = ({ transaction, isOpen, onClose, transactions }) => {
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [quickTip, setQuickTip] = useState<string>('');
  const [isLoadingQuickTip, setIsLoadingQuickTip] = useState(false);
  const [cleverAnalysis, setCleverAnalysis] = useState<string>('');
  const [isLoadingCleverAnalysis, setIsLoadingCleverAnalysis] = useState(false);

  useEffect(() => {
    if (transaction && isOpen) {
      setAiInsight('');
      setQuickTip('');
      setCleverAnalysis('');
      generateInsight();
      generateQuickTip();
      generateCleverAnalysis();
    }
  }, [transaction, isOpen]);

  const generateInsight = async () => {
    if (!transaction) return;
    
    setIsLoadingInsight(true);
    try {
      // Get similar transactions (same merchant and account)
      const merchantName = transaction.merchant_name || transaction.name;
      const accountId = transaction.account_id;
      const similarTransactions = transactions.filter(t => 
        (t.merchant_name || t.name) === merchantName &&
        t.account_id === accountId
      );

      const stats = calculateMerchantStats();
      
      // Check if this is an incoming transaction (negative amount)
      const isIncoming = transaction.amount < 0;

      // Different prompt based on transaction type - now focused on conversational insights
      let prompt = '';
      
      if (isIncoming) {
        // Updated prompt for incoming transactions - naturally shareable
        prompt = `Create a single thought-provoking "big picture" financial insight about this income transaction that would be genuinely interesting to share in conversation:

Transaction: $${Math.abs(transaction.amount)} from ${merchantName} (Account ID: ${accountId})
Pattern: You've received ${similarTransactions.length} payments from this source in this account, averaging $${(similarTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / similarTransactions.length).toFixed(2)}
Monthly: This source provides about $${stats?.monthlyAverage.toFixed(2)}/month (${stats?.percentOfAccountIncome.toFixed(1)}% of this account's income)
Overall: This represents ${stats?.percentOfIncome.toFixed(1)}% of your total income across all accounts ($${stats?.annualIncome ? (stats?.annualIncome/12).toFixed(2) : 'N/A'}/month)

Your deep insight should:
- Start with an emoji that represents the big idea
- Present a memorable or surprising perspective that's genuinely interesting
- Connect to broader financial or life principles people actually care about
- Feel insightful enough that someone would naturally mention it in conversation
- Be specific enough to this transaction to feel personalized
- Be 2-3 sentences maximum (40-50 words)

Important:
- NO hashtags or social media language
- NO marketing or promotional tone
- NO generic financial advice
- Focus on something surprising, counterintuitive, or perspective-changing

Write in a natural, conversational tone that sounds like something a thoughtful friend would say.`;
      } else {
        // Updated prompt for outgoing transactions - naturally shareable
        prompt = `Create a single thought-provoking "big picture" financial insight about this purchase that would be genuinely interesting to share in conversation:

Transaction: $${Math.abs(transaction.amount)} at ${merchantName} (Account ID: ${accountId})
Pattern: You've spent here ${similarTransactions.length} times in this account, averaging $${(similarTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / similarTransactions.length).toFixed(2)}
Monthly: You spend about $${stats?.monthlyAverage.toFixed(2)}/month here (${stats?.percentOfAccountIncome.toFixed(1)}% of this account's income)
Overall: This represents ${stats?.percentOfIncome.toFixed(1)}% of your total income across all accounts ($${stats?.annualIncome ? (stats?.annualIncome/12).toFixed(2) : 'N/A'}/month)
Rank: This is your #${stats?.merchantRank || 'N/A'} expense out of ${stats?.totalMerchants || 'N/A'} merchants for this account

Your deep insight should:
- Start with an emoji that represents the big idea
- Present a memorable or surprising perspective that's genuinely interesting
- Connect to broader financial or life principles people actually care about
- Feel insightful enough that someone would naturally mention it in conversation
- Be specific enough to this transaction to feel personalized
- Be 2-3 sentences maximum (40-50 words)

Important:
- NO hashtags or social media language
- NO marketing or promotional tone
- NO generic financial advice
- Focus on something surprising, counterintuitive, or perspective-changing

Write in a natural, conversational tone that sounds like something a thoughtful friend would say.`;
      }

      const messages = [{
        role: 'user',
        content: prompt
      }];

      const response = await fetch(`${API_URL}/openai/chat-with-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          transactions: similarTransactions,
        }),
      });

      const data = await response.json();
      const aiReply = data?.message || data?.reply || 'No insight available.';
      setAiInsight(aiReply);
    } catch (error) {
      console.error('Error generating insight:', error);
      setAiInsight('Unable to generate insight at this time. Please try again later.');
    } finally {
      setIsLoadingInsight(false);
    }
  };

  const generateQuickTip = async () => {
    if (!transaction) return;
    setIsLoadingQuickTip(true);
    try {
      const merchant = transaction.merchant_name || transaction.name;
      const isIncoming = transaction.amount < 0;
      const amount = Math.abs(transaction.amount);
      const accountId = transaction.account_id;
      const stats = calculateMerchantStats();
      
      // Different prompts based on transaction type with context but without overanalyzing
      const prompt = isIncoming 
        ? `Write a witty, useful, and emoji-filled one-liner about receiving $${amount} from ${merchant}.
           Context: 
           - This is an INCOME transaction in account ${accountId}
           - This represents ${stats?.percentOfAccountIncome.toFixed(1)}% of this account's income
           - Overall impact: ${stats?.percentOfIncome.toFixed(1)}% of total income across all accounts
           
           Focus on smart money management. Be practical and insightful.
           Max 140 characters. Do not include hashtags.`
        
        : `Write a witty, useful, and emoji-filled one-liner about a $${amount} expense at ${merchant}.
           Context:
           - This is an EXPENSE transaction in account ${accountId}
           - This represents ${stats?.percentOfAccountIncome.toFixed(1)}% of this account's income
           - Overall impact: ${stats?.percentOfIncome.toFixed(1)}% of total income across all accounts
           
           Make it clever and practically insightful.
           Max 140 characters. Do not include hashtags.`;

      const messages = [{
        role: 'user',
        content: prompt
      }];

      const response = await fetch(`${API_URL}/openai/chat-with-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, transactions: [] }),
      });

      const data = await response.json();
      const reply = data?.message || data?.reply || '';
      setQuickTip(reply);
    } catch (error) {
      console.error('Error generating quick tip:', error);
    } finally {
      setIsLoadingQuickTip(false);
    }
  };

  const generateCleverAnalysis = async () => {
    if (!transaction) return;
    setIsLoadingCleverAnalysis(true);
    try {
      const stats = calculateMerchantStats();
      const merchantName = transaction.merchant_name || transaction.name;
      const isIncoming = transaction.amount < 0;
      const accountId = transaction.account_id;
      
      // Create a prompt based on transaction type and pacing data
      const prompt = isIncoming 
        ? `You're a financial comedian with practical money advice.
           Based on this income in account ${accountId}:
           - Source: ${merchantName}
           - Amount: $${Math.abs(transaction.amount)}
           - Monthly income from this source: $${stats?.monthlyAverage.toFixed(2)}
           - Account Impact: ${stats?.percentOfAccountIncome.toFixed(1)}% of this account's income
           - Overall Impact: ${stats?.percentOfIncome.toFixed(1)}% of total income across all accounts ($${stats?.annualIncome ? (stats?.annualIncome/12).toFixed(2) : 'N/A'}/month)
           
           Write ONE funny, super-short (20-30 words max) money tip about how to make the most of this income.
           Make it witty and actionable. Use wordplay if possible.`
           
        : `You're a financial comedian with practical money advice.
           Based on this expense in account ${accountId}:
           - Merchant: ${merchantName}
           - Amount: $${Math.abs(transaction.amount)}
           - Monthly spend: $${stats?.monthlyAverage.toFixed(2)}
           - Account Impact: ${stats?.percentOfAccountIncome.toFixed(1)}% of this account's income
           - Overall Impact: ${stats?.percentOfIncome.toFixed(1)}% of total income across all accounts ($${stats?.annualIncome ? (stats?.annualIncome/12).toFixed(2) : 'N/A'}/month)
           
           Write ONE funny, super-short (20-30 words max) money tip about how to save money on this type of expense in the future.
           Make it witty and actionable. Use wordplay if possible.`;

      const messages = [{
        role: 'user',
        content: prompt
      }];

      const response = await fetch(`${API_URL}/openai/chat-with-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, transactions: [] }),
      });

      const data = await response.json();
      const reply = data?.message || data?.reply || '';
      setCleverAnalysis(reply);
    } catch (error) {
      console.error('Error generating clever analysis:', error);
      setCleverAnalysis('Unable to generate analysis at this time.');
    } finally {
      setIsLoadingCleverAnalysis(false);
    }
  };

  const calculateMerchantStats = () => {
    if (!transaction || !transactions) return null;

    const merchantName = transaction.merchant_name || transaction.name;
    const isIncoming = transaction.amount < 0;
    
    // Get the account_id of the current transaction for proper filtering
    const accountId = transaction.account_id;
    
    // Filter transactions by this merchant name AND same account
    const merchantTransactions = transactions.filter(t => 
      (t.merchant_name || t.name) === merchantName && 
      t.account_id === accountId
    );

    // Get category of the current transaction
    const transactionCategory = transaction.category && transaction.category.length > 0 
      ? transaction.category[0] 
      : null;

    // Find all transactions in the same primary category for broader analysis
    const categoryTransactions = transactionCategory 
      ? transactions.filter(t => 
          t.category && 
          t.category.length > 0 && 
          t.category[0] === transactionCategory &&
          (isIncoming ? t.amount < 0 : t.amount > 0) && // Match income vs expense
          t.account_id === accountId // Same account
        )
      : [];

    // Standardized time period calculations
    // First, ensure we have a range of dates to work with
    const allDates = merchantTransactions.map(t => new Date(t.date).getTime());
    const firstTransactionDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
    const latestTransactionDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();
    
    // Calculate more reliable time periods
    const daysSinceFirst = Math.max(1, Math.ceil((new Date().getTime() - firstTransactionDate.getTime()) / (1000 * 3600 * 24)));
    const daysBetweenFirstAndLatest = Math.max(1, Math.ceil((latestTransactionDate.getTime() - firstTransactionDate.getTime()) / (1000 * 3600 * 24)));
    
    // Adjust calculation periods for more accuracy
    // If we have multiple transactions over at least 30 days, use that period
    // Otherwise, use the days since first transaction but with reasonableness checks
    const calculationPeriodDays = (daysBetweenFirstAndLatest >= 30 && merchantTransactions.length > 1) 
      ? daysBetweenFirstAndLatest 
      : daysSinceFirst;
    
    // Base calculations for this merchant
    const totalSpent = merchantTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const averageSpent = merchantTransactions.length > 0 ? totalSpent / merchantTransactions.length : 0;
    const frequency = merchantTransactions.length;
    
    // Calculate monthly and annual values using a more reliable method
    const monthlyTransactionFrequency = (frequency / calculationPeriodDays) * 30;
    const monthlyAverage = (totalSpent / calculationPeriodDays) * 30;
    const annualAverage = monthlyAverage * 12;

    // Also get ALL income transactions across ALL accounts for total income comparison
    // const allIncomeTransactionsAcrossAccounts = transactions.filter(t => t.amount < 0);

    // Category spending analysis
    const categorySummary = transactionCategory ? {
      name: transactionCategory,
      totalSpent: categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      count: categoryTransactions.length,
      percentOfMerchant: categoryTransactions.length > 0 
        ? (merchantTransactions.length / categoryTransactions.length) * 100 
        : 0,
      averageAmount: categoryTransactions.length > 0 
        ? categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / categoryTransactions.length 
        : 0,
      monthlyAverage: 0, // Will be calculated later if available
      categoryRank: 0, // Will calculate below
      totalCategories: 0 // Will calculate below
    } : null;

    // Account Structure Analysis - Create a map of account transactions for better analytics
    // Group transactions by account to understand account distribution
    const accountTransactions = new Map<string, Transaction[]>();
    transactions.forEach((t: Transaction) => {
      if (!accountTransactions.has(t.account_id)) {
        accountTransactions.set(t.account_id, []);
      }
      accountTransactions.get(t.account_id)?.push(t);
    });

    // Calculate income and expenses by account with proper time periods
    const accountAnalytics = Array.from(accountTransactions.entries()).map(([accId, txns]) => {
      const accIncomeTxns = txns.filter(t => t.amount < 0);
      const accExpenseTxns = txns.filter(t => t.amount > 0);
      
      // Income calculations for this account
      const incomeData = calculatePeriodStats(accIncomeTxns);
      
      // Expense calculations for this account
      const expenseData = calculatePeriodStats(accExpenseTxns);
      
      return {
        accountId: accId,
        isCurrentAccount: accId === accountId,
        income: {
          total: incomeData.total,
          monthly: incomeData.monthly,
          annual: incomeData.annual,
          count: accIncomeTxns.length
        },
        expenses: {
          total: expenseData.total,
          monthly: expenseData.monthly,
          annual: expenseData.annual,
          count: accExpenseTxns.length
        }
      };
    });
    
    // Helper function to calculate consistent period-based stats for a set of transactions
    function calculatePeriodStats(txns: Transaction[]) {
      if (txns.length === 0) return { total: 0, monthly: 0, annual: 0 };
      
      const total = txns.reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);
      
      // Calculate time period based on transaction history
      const txnDates = txns.map(t => new Date(t.date).getTime());
      const firstDate = new Date(Math.min(...txnDates));
      const lastDate = new Date(Math.max(...txnDates));
      const daysBetween = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 3600 * 24)));
      
      // Use a reliable period for calculations
      let calcPeriod = daysBetween;
      
      // If we only have transactions within a very short period, use a different approach
      if (daysBetween < 7 && txns.length < 3) {
        // For very limited data, make conservative estimates
        calcPeriod = 30; // Assume monthly for single transactions
      } else if (daysBetween < 30 && txns.length >= 3) {
        // With several transactions in a short period, extrapolate carefully
        calcPeriod = Math.max(daysBetween, 15);
      }
      
      const monthly = (total / calcPeriod) * 30;
      const annual = monthly * 12;
      
      return { total, monthly, annual };
    }
    
    // Calculate overall account income and expenses
    const totalAccountIncome = accountAnalytics
      .filter(acc => acc.accountId === accountId)
      .reduce((sum, acc) => sum + acc.income.annual, 0);
    
    const totalAccountExpenses = accountAnalytics
      .filter(acc => acc.accountId === accountId)
      .reduce((sum, acc) => sum + acc.expenses.annual, 0);
    
    // Calculate all accounts income and expenses
    const totalAllAccountsIncome = accountAnalytics.reduce((sum, acc) => sum + acc.income.annual, 0);
    const totalAllAccountsExpenses = accountAnalytics.reduce((sum, acc) => sum + acc.expenses.annual, 0);
    
    // For reliability, ensure we have minimum reasonable values
    const fallbackAnnualIncome = 50000; // Default fallback annual income
    
    // Use calculated values with fallbacks for reliability
    const annualIncome = totalAllAccountsIncome > 10000 ? totalAllAccountsIncome : fallbackAnnualIncome;
    const accountAnnualIncome = totalAccountIncome > 5000 ? totalAccountIncome : (annualIncome * 0.7); // Assume this account has 70% of income if we can't calculate
    
    // Calculate more trustworthy income and expense percentages
    let percentOfIncome = 0;
    let percentOfAccountIncome = 0;
    
    if (isIncoming) {
      // For income: Calculate what percent of total income comes from this source
      percentOfIncome = annualIncome > 0 ? (annualAverage / annualIncome) * 100 : 0;
      
      // Also calculate percentage of this account's income
      percentOfAccountIncome = accountAnnualIncome > 0 ? (annualAverage / accountAnnualIncome) * 100 : 0;
    } else {
      // For expenses: Calculate what percent of annual income is spent here
      percentOfIncome = annualIncome > 0 ? (annualAverage / annualIncome) * 100 : 0;
      
      // Also calculate percentage of this account's income that is spent here
      percentOfAccountIncome = accountAnnualIncome > 0 ? (annualAverage / accountAnnualIncome) * 100 : 0;
    }

    // New: Create merchant spending ranking with more reliable calculations
    let merchantRank = 0;
    let totalMerchants = 0;
    
    if (!isIncoming) {
      // Get all outgoing/expense transactions for this account
      const expenseTransactions = transactions.filter(t => t.amount > 0 && t.account_id === accountId);
      
      // Group by merchant and calculate total spent
      interface MerchantSpending {
        name: string;
        total: number;
        monthlyAvg: number;
        frequency: number;
      }
      
      const merchantSpending: MerchantSpending[] = [];
      const merchantMap: {[key: string]: number} = {};
      
      expenseTransactions.forEach(t => {
        const merchant = t.merchant_name || t.name || 'Unknown';
        if (!merchantMap[merchant]) {
          merchantMap[merchant] = merchantSpending.length;
          merchantSpending.push({
            name: merchant,
            total: 0,
            monthlyAvg: 0,
            frequency: 0
          });
        }
        merchantSpending[merchantMap[merchant]].total += Math.abs(t.amount);
        merchantSpending[merchantMap[merchant]].frequency += 1;
      });
      
      // Use the same reliable calculation method for all merchants
      merchantSpending.forEach(m => {
        const merchantTxs = expenseTransactions.filter(t => 
          (t.merchant_name || t.name) === m.name
        );
        
        if (merchantTxs.length > 0) {
          const txDates = merchantTxs.map(t => new Date(t.date).getTime());
          const firstTx = new Date(Math.min(...txDates));
          const lastTx = new Date(Math.max(...txDates));
          
          const daysBetween = Math.max(1, Math.ceil((lastTx.getTime() - firstTx.getTime()) / (1000 * 3600 * 24)));
          const daysSince = Math.max(1, Math.ceil((new Date().getTime() - firstTx.getTime()) / (1000 * 3600 * 24)));
          
          // Use the most appropriate calculation period
          const calcPeriod = (daysBetween >= 30 && merchantTxs.length > 1) ? daysBetween : daysSince;
          
          m.monthlyAvg = (m.total / calcPeriod) * 30;
        }
      });
      
      // Sort by monthly average spending (highest first)
      merchantSpending.sort((a, b) => b.monthlyAvg - a.monthlyAvg);
      
      // Find the rank of the current merchant
      merchantRank = merchantSpending.findIndex(m => m.name === merchantName) + 1;
      totalMerchants = merchantSpending.length;

      // Calculate category rankings with the same reliable approach
      if (transactionCategory) {
        // Get unique categories from expense transactions
        const categories = new Set<string>();
        const categorySpending: {[key: string]: {total: number, txns: Transaction[]}} = {};
        
        expenseTransactions.forEach(t => {
          if (t.category && t.category.length > 0) {
            const cat = t.category[0];
            categories.add(cat);
            if (!categorySpending[cat]) categorySpending[cat] = {total: 0, txns: []};
            categorySpending[cat].total += Math.abs(t.amount);
            categorySpending[cat].txns.push(t);
          }
        });
        
        // Process categories with the more reliable method
        const categoryRankings = Array.from(categories).map(cat => {
          const txns = categorySpending[cat].txns;
          const txnDates = txns.map(t => new Date(t.date).getTime());
          const firstDate = txns.length > 0 ? new Date(Math.min(...txnDates)) : new Date();
          const lastDate = txns.length > 0 ? new Date(Math.max(...txnDates)) : new Date();
          
          const daysBetween = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 3600 * 24)));
          const daysSince = Math.max(1, Math.ceil((new Date().getTime() - firstDate.getTime()) / (1000 * 3600 * 24)));
          
          // Use appropriate calculation period
          const calcPeriod = (daysBetween >= 30 && txns.length > 1) ? daysBetween : daysSince;
          const monthlyAvg = (categorySpending[cat].total / calcPeriod) * 30;
          
          return {
            name: cat,
            total: categorySpending[cat].total,
            monthlyAvg,
            count: txns.length
          };
        }).sort((a, b) => b.monthlyAvg - a.monthlyAvg);
        
        // Update category summary with improved metrics
        if (categorySummary) {
          categorySummary.categoryRank = categoryRankings.findIndex(c => c.name === transactionCategory) + 1;
          categorySummary.totalCategories = categoryRankings.length;
          
          // Add monthly average to category summary
          const categoryData = categoryRankings.find(c => c.name === transactionCategory);
          if (categoryData) {
            categorySummary.monthlyAverage = categoryData.monthlyAvg;
          }
        }
      }
    }
    
    // Summary of all accounts for complete financial context
    const accountsSummary = accountAnalytics.map(acc => ({
      accountId: acc.accountId,
      isCurrentAccount: acc.accountId === accountId,
      monthlyIncome: acc.income.monthly,
      monthlyExpenses: acc.expenses.monthly,
      annualIncome: acc.income.annual,
      annualExpenses: acc.expenses.annual,
      netMonthly: acc.income.monthly - acc.expenses.monthly,
      netAnnual: acc.income.annual - acc.expenses.annual
    }));

    return {
      // Merchant-specific metrics
      totalSpent,
      averageSpent,
      frequency,
      monthlyAverage: monthlyAverage,
      annualAverage: annualAverage, // New more accurate annual average
      daysSinceFirst,
      monthlyTransactionFrequency: monthlyTransactionFrequency, // New frequency metric
      
      // Type indicator
      isIncoming,
      
      // Income metrics - more reliable calculations
      annualIncome,             // Total income across all accounts
      accountAnnualIncome,      // Income for just this account
      monthlyIncome: annualIncome / 12,
      accountMonthlyIncome: accountAnnualIncome / 12,
      
      // Percentage metrics
      percentOfIncome,          // Percentage of ALL income
      percentOfAccountIncome,   // Percentage of just this account's income
      
      // Rankings
      merchantRank,
      totalMerchants,
      
      // Category data
      category: categorySummary,
      hasCategory: !!transactionCategory,
      
      // Account data
      accountId,
      
      // New: Account overview for better context
      accountsSummary,
      totalAccounts: accountAnalytics.length,
      
      // Calculation quality indicators
      dataReliability: merchantTransactions.length > 2 && daysSinceFirst > 30 ? 'high' : 
                      (merchantTransactions.length > 1 ? 'medium' : 'low'),
    };
  };

  if (!transaction) return null;
  const stats = calculateMerchantStats();

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 bg-white z-10 shadow-sm">
          <h2 className="text-xl font-semibold text-left">Transaction Details</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-left">
          {/* Transaction Overview */}
          <div className="p-4 bg-white rounded-xl border-2 border-blue-200 shadow-sm">
            <div className="flex items-center mb-2">
              <span 
                className={`px-3 py-1 text-sm rounded-full ${transaction.amount < 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
              >
                {transaction.amount < 0 ? '← Incoming' : '→ Outgoing'}
              </span>
              <span className="ml-2 text-sm text-gray-500">{new Date(transaction.date).toLocaleDateString()}</span>
            </div>
            <h3 className="text-lg font-semibold text-left">{transaction.merchant_name || transaction.name}</h3>
            <p className={`text-2xl font-bold text-left ${transaction.amount < 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(transaction.amount).toFixed(2)}
            </p>
            
            {transaction.category && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {transaction.category.map((category, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full border border-gray-200"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Quick Insights with Financial Impact inserted between Clever Tip and Money Tip */}
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-xl p-3 text-sm text-purple-700 font-medium border-2 border-purple-300 shadow">
              <div className="flex items-center mb-2">
                <span className="mr-2 text-lg">💡</span>
                <span className="font-semibold text-base">Clever Tip</span>
              </div>
              <div className="min-h-[30px]">
                {isLoadingQuickTip ? (
                  <span className="text-gray-400 italic">Generating something clever...</span>
                ) : (
                  quickTip
                )}
              </div>
            </div>
          </div>
          
          {/* Financial Impact - Moved between Clever Tip and Money Tip */}
          {stats && (
            <div className="bg-white rounded-xl p-4 border-2 border-indigo-200 shadow-sm">
              <div className="flex items-center mb-3">
                <span className="mr-2 text-lg">📊</span>
                <span className="font-semibold text-base text-gray-800">Financial Impact</span>
              </div>
              <div className="space-y-4">
                {stats.isIncoming ? (
                  // Display for income transactions
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">This Source Monthly</p>
                        <p className="text-lg font-semibold text-blue-900">${(stats.annualAverage / 12).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">From {transaction.merchant_name || transaction.name}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">This Source Annually</p>
                        <p className="text-lg font-semibold text-blue-900">${stats.annualAverage.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">From {transaction.merchant_name || transaction.name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center py-3 mt-2">
                      <div className="flex flex-col items-center">
                        <div className="relative w-32 h-32 border-2 border-gray-300 rounded-full">
                          {/* Background circle (100%) */}
                          <div className="absolute inset-0 rounded-full bg-gray-200"></div>
                          {/* Foreground segment (the actual percentage) - rotate and use conic gradient */}
                          <div 
                            className="absolute inset-0 rounded-full bg-green-500"
                            style={{ 
                              background: `conic-gradient(#10b981 0% ${Math.min(stats.percentOfAccountIncome, 100)}%, transparent ${Math.min(stats.percentOfAccountIncome, 100)}% 100%)` 
                            }}
                          ></div>
                          {/* Inner white circle to create donut effect */}
                          <div className="absolute inset-0 m-3 rounded-full bg-white flex items-center justify-center">
                            <div className="text-center">
                              <span className="text-lg font-bold text-blue-900">{Math.min(stats.percentOfAccountIncome, 100).toFixed(1)}%</span>
                              <p className="text-xs text-blue-700">of account's total income</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 text-sm text-blue-700 bg-blue-100 p-3 rounded-lg">
                      This source provides approximately ${(stats.annualAverage / 12).toFixed(2)} per month (${stats.annualAverage.toFixed(2)} annually) to this account, representing {stats.percentOfAccountIncome > 100 ? '100+' : stats.percentOfAccountIncome.toFixed(2)}% of the total income for this account.
                      <br/><br/>
                      <span className="font-semibold">Overall Impact:</span> This source represents {stats.percentOfIncome > 100 ? '100+' : stats.percentOfIncome.toFixed(2)}% of your total income across all accounts (${stats?.annualIncome ? (stats?.annualIncome/12).toFixed(2) : 'N/A'}/month).
                    </div>
                  </>
                ) : (
                  // Display for expense transactions
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">Monthly Spend Pace</p>
                        <p className="text-lg font-semibold text-blue-900">${(stats.annualAverage / 12).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">In this account</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">Annual Spend Pace</p>
                        <p className="text-lg font-semibold text-blue-900">${stats.annualAverage.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">In this account</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center py-3 gap-6">
                      <div className="flex flex-col items-center">
                        <div className="relative w-32 h-32 border-2 border-gray-300 rounded-full">
                          {/* Background circle (100%) */}
                          <div className="absolute inset-0 rounded-full bg-gray-200"></div>
                          {/* Foreground segment (the actual percentage) - use conic gradient with color based on percentage */}
                          <div 
                            className="absolute inset-0 rounded-full"
                            style={{ 
                              background: `conic-gradient(#ef4444 0% ${Math.min(stats.percentOfAccountIncome, 100)}%, transparent ${Math.min(stats.percentOfAccountIncome, 100)}% 100%)` 
                            }}
                          ></div>
                          {/* Inner white circle to create donut effect */}
                          <div className="absolute inset-0 m-3 rounded-full bg-white flex items-center justify-center">
                            <div className="text-center">
                              <span className="text-lg font-bold text-blue-900">{Math.min(stats.percentOfAccountIncome, 100).toFixed(1)}%</span>
                              <p className="text-xs text-blue-700">of account's total income</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {stats.merchantRank > 0 && (
                        <div className="bg-white rounded-lg p-4 flex flex-col items-center justify-center border-2 border-red-200 shadow-sm">
                          <span className="text-2xl font-bold text-red-600">#{stats.merchantRank}</span>
                          <span className="text-sm text-gray-700">of {stats.totalMerchants}</span>
                          <span className="text-xs text-gray-500 mt-1">expense{stats.totalMerchants !== 1 ? 's' : ''} in account</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Add category analysis when available */}
                    {stats.hasCategory && stats.category && (
                      <div className="flex items-center justify-center mt-4">
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200 w-full">
                          <h5 className="text-sm text-green-800 font-medium mb-2">Category Analysis: {stats.category.name}</h5>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-green-700">Category Total</p>
                              <p className="font-semibold">${stats.category.totalSpent.toFixed(2)}</p>
                              <p className="text-xs text-green-700">In this account</p>
                            </div>
                            <div>
                              <p className="text-green-700">Category Avg</p>
                              <p className="font-semibold">${stats.category.monthlyAverage.toFixed(2)}</p>
                            </div>
                            {stats.category.categoryRank > 0 && (
                              <div>
                                <p className="text-green-700">Category Rank</p>
                                <p className="font-semibold">#{stats.category.categoryRank} of {stats.category.totalCategories}</p>
                                <p className="text-xs text-green-700">In this account</p>
                              </div>
                            )}
                            <div>
                              <p className="text-green-700">Transactions</p>
                              <p className="font-semibold">{stats.category.count} total</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-3 text-sm text-blue-700 bg-blue-100 p-3 rounded-lg">
                      If you continue this spending pattern in this account, you'll spend about ${(stats.annualAverage / 12).toFixed(2)} monthly (${stats.annualAverage.toFixed(2)} annually) at {transaction.merchant_name || transaction.name}, which is {stats.percentOfAccountIncome > 100 ? '100+' : stats.percentOfAccountIncome.toFixed(2)}% of this account's total income.
                      <br/><br/>
                      <span className="font-semibold">Overall Impact:</span> This spending represents {stats.percentOfIncome > 100 ? '100+' : stats.percentOfIncome.toFixed(2)}% of your total income across all accounts (${stats?.annualIncome ? (stats?.annualIncome/12).toFixed(2) : 'N/A'}/month).
                      {stats.hasCategory && stats.category && 
                        ` This transaction is in the "${stats.category.name}" category, which accounts for ${stats.category.count} transactions in your account history.`
                      }
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* Money Tip - Now after Financial Impact */}
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-xl p-3 text-sm text-amber-600 font-medium border-2 border-amber-300 shadow">
              <div className="flex items-center mb-2">
                <span className="mr-2 text-lg">💰</span>
                <span className="font-semibold text-base">Save or Make Money Tip</span>
              </div>
              <div className="min-h-[30px]">
                {isLoadingCleverAnalysis ? (
                  <span className="text-gray-400 italic">Crafting a money tip...</span>
                ) : (
                  cleverAnalysis
                )}
              </div>
            </div>
          </div>
          
          {/* NEW: Financial Overview - Multi-Account Analysis */}
          {stats && stats.totalAccounts > 1 && (
            <div className="bg-white rounded-xl p-4 border-2 border-purple-200 shadow-sm">
              <div className="flex items-center mb-3">
                <span className="mr-2 text-lg">🏦</span>
                <span className="font-semibold text-base text-gray-800">Financial Overview</span>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3">
                  <h5 className="text-sm font-medium text-purple-800 mb-2">Multi-Account Summary</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/80 p-2 rounded shadow-sm">
                      <p className="text-xs text-purple-600">Total Monthly Income</p>
                      <p className="text-base font-semibold">${(stats.annualIncome / 12).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">Across all accounts</p>
                    </div>
                    <div className="bg-white/80 p-2 rounded shadow-sm">
                      <p className="text-xs text-purple-600">Data Reliability</p>
                      <p className="text-base font-semibold capitalize">{stats.dataReliability}</p>
                      <p className="text-xs text-gray-500">{stats.dataReliability === 'high' ? 'Strong historical data' : stats.dataReliability === 'medium' ? 'Moderate data sample' : 'Limited transaction history'}</p>
                    </div>
                  </div>
                </div>
                
                {/* Account comparison table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                        <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Income</th>
                        <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Expenses</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.accountsSummary.map((account, index) => (
                        <tr key={index} className={account.isCurrentAccount ? 'bg-blue-50' : ''}>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="ml-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {account.isCurrentAccount ? '→ This Account' : `Account ${account.accountId.substring(0, 4)}...`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900">${account.monthlyIncome.toFixed(2)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900">${account.monthlyExpenses.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Account insights */}
                <div className="mt-3 text-sm text-purple-700 bg-purple-50 p-3 rounded-lg">
                  <p className="mb-2">
                    <span className="font-semibold">Transaction Context:</span> This transaction is from an account representing {((stats.accountAnnualIncome / stats.annualIncome) * 100).toFixed(1)}% of your total income.
                  </p>
                  <p>
                    For the most accurate financial picture, all {stats.totalAccounts} of your accounts have been analyzed to provide comprehensive insights about your overall financial health.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Merchant Analysis */}
          {stats && (
            <div className="bg-white rounded-xl p-4 border-2 border-cyan-200 shadow-sm">
              <div className="flex items-center mb-3">
                <span className="mr-2 text-lg">📈</span>
                <span className="font-semibold text-base text-gray-800">Historical Analysis</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">{stats.isIncoming ? 'Total Received' : 'Total Spent'}</p>
                  <p className="text-lg font-semibold">${stats.totalSpent.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Last {stats.daysSinceFirst} days</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Avg. Transaction</p>
                  <p className="text-lg font-semibold">${stats.averageSpent.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">From {stats.frequency} transactions</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">{stats.isIncoming ? 'Monthly Income' : 'Monthly Spend'}</p>
                  <p className="text-lg font-semibold">${stats.monthlyAverage.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Frequency</p>
                  <p className="text-lg font-semibold">{stats.frequency} times</p>
                  <p className="text-xs text-gray-500">~{(stats.frequency / (stats.daysSinceFirst / 30)).toFixed(1)}/month</p>
                </div>
              </div>
            </div>
          )}

          {/* Full AI Analysis - Updated to a more compact, impactful section */}
          {aiInsight && (
            <div className="bg-white rounded-xl p-4 text-sm border-2 border-teal-300 shadow-sm">
              <div className="flex items-center mb-3">
                <span className="mr-2 text-lg">🧠</span>
                <span className="font-semibold text-base text-gray-800">Deep AI Insight</span>
              </div>
              <div className="text-gray-800 text-base font-normal px-2">
                {isLoadingInsight ? (
                  <div className="flex items-center justify-center p-3">
                    <span className="text-gray-400">Uncovering a big picture insight...</span>
                  </div>
                ) : (
                  <p className="leading-relaxed">{aiInsight}</p>
                )}
              </div>
            </div>
          )}

          {/* Transaction Details */}
          <div className="bg-white rounded-xl p-4 border-2 border-slate-200 shadow-sm">
              <div className="flex items-center mb-3">
                <span className="mr-2 text-lg">📋</span>
                <span className="font-semibold text-base text-gray-800">Additional Details</span>
              </div>
            <div className="grid grid-cols-1 gap-3">
              {transaction.location && (
                <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <label className="text-sm text-gray-600 block font-medium">Location</label>
                  <p className="text-gray-900">{[
                    transaction.location.address,
                    transaction.location.city,
                    transaction.location.state,
                    transaction.location.postal_code
                  ].filter(Boolean).join(', ')}</p>
                </div>
              )}

              <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                <label className="text-sm text-gray-600 block font-medium">Status</label>
                <p className="text-gray-900 flex items-center">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${transaction.pending ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                  {transaction.pending ? 'Pending' : 'Posted'}
                </p>
              </div>

              {transaction.payment_channel && (
                <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <label className="text-sm text-gray-600 block font-medium">Payment Method</label>
                  <p className="text-gray-900 capitalize">{transaction.payment_channel}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionDrawer;