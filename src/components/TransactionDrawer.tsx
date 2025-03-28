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
      // Get similar transactions (same merchant)
      const merchantName = transaction.merchant_name || transaction.name;
      const similarTransactions = transactions.filter(t => 
        (t.merchant_name || t.name) === merchantName
      );

      const stats = calculateMerchantStats();
      
      // Check if this is an incoming transaction (negative amount)
      const isIncoming = transaction.amount < 0;

      // Different prompt based on transaction type - now focused on conversational insights
      let prompt = '';
      
      if (isIncoming) {
        // Updated prompt for incoming transactions - naturally shareable
        prompt = `Create a single thought-provoking "big picture" financial insight about this income transaction that would be genuinely interesting to share in conversation:

Transaction: $${Math.abs(transaction.amount)} from ${merchantName}
Pattern: You've received ${similarTransactions.length} payments from this source, averaging $${(similarTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / similarTransactions.length).toFixed(2)}
Monthly: This source provides about $${stats?.monthlyAverage.toFixed(2)}/month (${stats?.percentOfIncome.toFixed(1)}% of your income)

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

Transaction: $${Math.abs(transaction.amount)} at ${merchantName}
Pattern: You've spent here ${similarTransactions.length} times, averaging $${(similarTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / similarTransactions.length).toFixed(2)}
Monthly: You spend about $${stats?.monthlyAverage.toFixed(2)}/month here (${stats?.percentOfIncome.toFixed(1)}% of your income)
Rank: This is your #${stats?.merchantRank || 'N/A'} expense out of ${stats?.totalMerchants || 'N/A'} merchants

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
      const prompt = isIncoming 
        ? `Write a witty, useful, and emoji-filled one-liner about receiving $${Math.abs(transaction.amount)} from ${merchant}. Focus on smart money management. Max 140 characters. Do not include hashtags.`
        : `Write a witty, useful, and emoji-filled one-liner about a $${Math.abs(transaction.amount)} transaction at ${merchant}. Make it clever and practically insightful. Max 140 characters. Do not include hashtags.`;

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
      
      // Create a prompt based on transaction type and pacing data
      const prompt = isIncoming 
        ? `You're a financial comedian with practical money advice.
           Based on this income:
           - Source: ${merchantName}
           - Amount: $${Math.abs(transaction.amount)}
           - Monthly income from this source: $${stats?.monthlyAverage.toFixed(2)}
           
           Write ONE funny, super-short (20-30 words max) money tip about how to make the most of this income.
           Make it witty and actionable. Use wordplay if possible.`
           
        : `You're a financial comedian with practical money advice.
           Based on this expense:
           - Merchant: ${merchantName}
           - Amount: $${Math.abs(transaction.amount)}
           - Monthly spend: $${stats?.monthlyAverage.toFixed(2)}
           
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
    
    // Filter transactions by this merchant name
    const merchantTransactions = transactions.filter(t => 
      (t.merchant_name || t.name) === merchantName
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
          (isIncoming ? t.amount < 0 : t.amount > 0) // Match income vs expense
        )
      : [];

    const totalSpent = merchantTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const averageSpent = totalSpent / merchantTransactions.length;
    const frequency = merchantTransactions.length;
    const firstTransaction = new Date(Math.min(...merchantTransactions.map(t => new Date(t.date).getTime())));
    const daysSinceFirst = Math.ceil((new Date().getTime() - firstTransaction.getTime()) / (1000 * 3600 * 24));
    const monthlyAverage = (totalSpent / daysSinceFirst) * 30;
    
    // For income transactions, use monthly * 12 for annual pace
    // For expenses, continue with the day-based calculation
    const annualPacing = isIncoming 
      ? monthlyAverage * 12  // Income: Monthly income * 12
      : (totalSpent / daysSinceFirst) * 365; // Expenses: Daily spend * 365
    
    // Identify all income transactions for income analysis
    const allIncomeTransactions = transactions.filter(t => t.amount < 0);

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
      categoryRank: 0, // Will calculate below
      totalCategories: 0 // Will calculate below
    } : null;
    
    // New: Create merchant spending ranking
    let merchantRank = 0;
    let totalMerchants = 0;
    
    if (!isIncoming) {
      // Get all outgoing/expense transactions
      const expenseTransactions = transactions.filter(t => t.amount > 0);
      
      // Group by merchant and calculate total spent
      interface MerchantSpending {
        name: string;
        total: number;
        monthlyAvg: number;
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
            monthlyAvg: 0
          });
        }
        merchantSpending[merchantMap[merchant]].total += Math.abs(t.amount);
      });
      
      // Calculate monthly averages for each merchant
      merchantSpending.forEach(m => {
        const merchantTxs = expenseTransactions.filter(t => 
          (t.merchant_name || t.name) === m.name
        );
        
        if (merchantTxs.length > 0) {
          const firstTx = new Date(Math.min(...merchantTxs.map(t => new Date(t.date).getTime())));
          const daysSince = Math.ceil((new Date().getTime() - firstTx.getTime()) / (1000 * 3600 * 24));
          if (daysSince > 0) {
            m.monthlyAvg = (m.total / daysSince) * 30;
          }
        }
      });
      
      // Sort by monthly average spending (highest first)
      merchantSpending.sort((a, b) => b.monthlyAvg - a.monthlyAvg);
      
      // Find the rank of the current merchant
      merchantRank = merchantSpending.findIndex(m => m.name === merchantName) + 1;
      totalMerchants = merchantSpending.length;

      // Calculate category rankings if we have category data
      if (transactionCategory) {
        // Get unique categories from expense transactions
        const categories = new Set<string>();
        const categorySpending: {[key: string]: number} = {};
        
        expenseTransactions.forEach(t => {
          if (t.category && t.category.length > 0) {
            const cat = t.category[0];
            categories.add(cat);
            if (!categorySpending[cat]) categorySpending[cat] = 0;
            categorySpending[cat] += Math.abs(t.amount);
          }
        });
        
        // Convert to array and sort by spending amount
        const categoryRankings = Array.from(categories).map(cat => ({
          name: cat,
          total: categorySpending[cat]
        })).sort((a, b) => b.total - a.total);
        
        // Find rank of current category
        if (categorySummary) {
          categorySummary.categoryRank = categoryRankings.findIndex(c => c.name === transactionCategory) + 1;
          categorySummary.totalCategories = categoryRankings.length;
        }
      }
    }
    
    // For income specific analysis
    let annualIncome = 50000; // Default fallback annual income
    
    // Define types for our income tracking objects
    interface IncomeSourceInfo {
      amount: number;
      count: number;
      earliest: number;
      annualPace?: number;
      percentOfTotal?: number;
      monthlyAverage?: number;
    }
    
    interface IncomeBySourceMap {
      [key: string]: IncomeSourceInfo;
    }
    
    interface IncomeDetailType {
      totalAnnualIncome: number;
      totalMonthlyIncome: number;
      incomeBySource: IncomeBySourceMap;
    }
    
    // Initialize with proper typing
    let incomeDetail: IncomeDetailType = {
      totalAnnualIncome: annualIncome,
      totalMonthlyIncome: annualIncome / 12,
      incomeBySource: {}
    };
    
    if (allIncomeTransactions.length > 0) {
      const totalIncome = allIncomeTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const oldestIncomeTransaction = new Date(Math.min(...allIncomeTransactions.map(t => new Date(t.date).getTime())));
      const daysSinceFirstIncome = Math.ceil((new Date().getTime() - oldestIncomeTransaction.getTime()) / (1000 * 3600 * 24));
      
      // Calculate monthly income first
      const monthlyIncomeAverage = (totalIncome / daysSinceFirstIncome) * 30;
      
      // Annual income is monthly * 12
      annualIncome = monthlyIncomeAverage * 12;
      
      incomeDetail.totalMonthlyIncome = monthlyIncomeAverage;
      incomeDetail.totalAnnualIncome = annualIncome;
      
      // Group income by source for a breakdown
      const incomeBySource: IncomeBySourceMap = {};
      allIncomeTransactions.forEach(t => {
        const source = t.merchant_name || t.name || 'Unknown';
        if (!incomeBySource[source]) {
          incomeBySource[source] = {
            amount: 0,
            count: 0,
            earliest: new Date().getTime()
          };
        }
        incomeBySource[source].amount += Math.abs(t.amount);
        incomeBySource[source].count += 1;
        const txDate = new Date(t.date).getTime();
        if (txDate < incomeBySource[source].earliest) {
          incomeBySource[source].earliest = txDate;
        }
      });
      
      // Calculate annual pace for each income source using monthly * 12
      Object.keys(incomeBySource).forEach(source => {
        const info = incomeBySource[source];
        const daysSince = Math.ceil((new Date().getTime() - info.earliest) / (1000 * 3600 * 24));
        if (daysSince >= 7) {
          // Calculate monthly average first
          info.monthlyAverage = (info.amount / daysSince) * 30;
          // Annual pace is monthly * 12
          info.annualPace = info.monthlyAverage * 12;
          info.percentOfTotal = (info.annualPace / annualIncome) * 100;
        }
      });
      
      incomeDetail.incomeBySource = incomeBySource;
    }
    
    // For expense transactions, calculate percentage of annual income
    const percentOfIncome = isIncoming 
      ? (annualPacing / annualIncome) * 100  // For income: what percent of total income is this source
      : (annualPacing / annualIncome) * 100; // For expense: what percent of income is spent here

    return {
      totalSpent,
      averageSpent,
      frequency,
      monthlyAverage,
      daysSinceFirst,
      isIncoming,
      annualPacing,
      annualIncome,
      monthlyIncome: annualIncome / 12,
      percentOfIncome,
      incomeDetail,
      merchantRank,
      totalMerchants,
      category: categorySummary,
      hasCategory: !!transactionCategory
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
                        <p className="text-sm text-blue-700">Monthly Income</p>
                        <p className="text-lg font-semibold text-blue-900">${(stats.annualIncome / 12).toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">Annual Income</p>
                        <p className="text-lg font-semibold text-blue-900">${stats.annualIncome.toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">This Source Monthly</p>
                        <p className="text-lg font-semibold text-blue-900">${(stats.annualPacing / 12).toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">This Source Annually</p>
                        <p className="text-lg font-semibold text-blue-900">${stats.annualPacing.toFixed(2)}</p>
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
                              background: `conic-gradient(#10b981 0% ${Math.min(stats.percentOfIncome, 100)}%, transparent ${Math.min(stats.percentOfIncome, 100)}% 100%)` 
                            }}
                          ></div>
                          {/* Inner white circle to create donut effect */}
                          <div className="absolute inset-0 m-3 rounded-full bg-white flex items-center justify-center">
                            <div className="text-center">
                              <span className="text-lg font-bold text-blue-900">{stats.percentOfIncome.toFixed(1)}%</span>
                              <p className="text-xs text-blue-700">of total income</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 text-sm text-blue-700 bg-blue-100 p-3 rounded-lg">
                      This source provides approximately ${(stats.annualPacing / 12).toFixed(2)} per month (${stats.annualPacing.toFixed(2)} annually), representing {stats.percentOfIncome.toFixed(2)}% of your total income.
                    </div>
                  </>
                ) : (
                  // Display for expense transactions
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">Monthly Spend Pace</p>
                        <p className="text-lg font-semibold text-blue-900">${(stats.annualPacing / 12).toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">Annual Spend Pace</p>
                        <p className="text-lg font-semibold text-blue-900">${stats.annualPacing.toFixed(2)}</p>
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
                              background: `conic-gradient(#ef4444 0% ${Math.min(stats.percentOfIncome, 100)}%, transparent ${Math.min(stats.percentOfIncome, 100)}% 100%)` 
                            }}
                          ></div>
                          {/* Inner white circle to create donut effect */}
                          <div className="absolute inset-0 m-3 rounded-full bg-white flex items-center justify-center">
                            <div className="text-center">
                              <span className="text-lg font-bold text-blue-900">{stats.percentOfIncome.toFixed(1)}%</span>
                              <p className="text-xs text-blue-700">of monthly income</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {stats.merchantRank > 0 && (
                        <div className="bg-white rounded-lg p-4 flex flex-col items-center justify-center border-2 border-red-200 shadow-sm">
                          <span className="text-2xl font-bold text-red-600">#{stats.merchantRank}</span>
                          <span className="text-sm text-gray-700">of {stats.totalMerchants}</span>
                          <span className="text-xs text-gray-500 mt-1">expense{stats.totalMerchants !== 1 ? 's' : ''}</span>
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
                            </div>
                            <div>
                              <p className="text-green-700">Category Avg</p>
                              <p className="font-semibold">${stats.category.averageAmount.toFixed(2)}</p>
                            </div>
                            {stats.category.categoryRank > 0 && (
                              <div>
                                <p className="text-green-700">Category Rank</p>
                                <p className="font-semibold">#{stats.category.categoryRank} of {stats.category.totalCategories}</p>
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
                      If you continue this spending pattern, you'll spend about ${(stats.annualPacing / 12).toFixed(2)} monthly (${stats.annualPacing.toFixed(2)} annually) at {transaction.merchant_name || transaction.name}, which is {stats.percentOfIncome.toFixed(2)}% of your income.
                      {stats.hasCategory && stats.category && 
                        ` This transaction is in the "${stats.category.name}" category, which accounts for ${stats.category.count} transactions in your history.`
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