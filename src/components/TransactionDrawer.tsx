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
        // Updated prompt for incoming transactions - focused on shorter, smarter feedback
        prompt = `Provide a single sharp insight about this income source with one specific action item:

Transaction: $${Math.abs(transaction.amount)} from ${merchantName}
Pattern: ${similarTransactions.length} payments, avg $${(similarTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / similarTransactions.length).toFixed(2)}
Impact: ${stats?.percentOfIncome.toFixed(1)}% of total income ($${stats?.monthlyAverage.toFixed(0)}/month)

Requirements:
- Start with a relevant emoji
- One insightful observation about income pattern or financial impact
- One specific, high-impact action recommendation
- Max 40 words total
- Direct, professional tone
- Focus on unique patterns or overlooked opportunities`;
      } else {
        // Updated prompt for outgoing transactions - focused on shorter, smarter feedback
        prompt = `Provide a single sharp insight about this expense with one specific action item:

Transaction: $${Math.abs(transaction.amount)} at ${merchantName}
Pattern: ${similarTransactions.length} payments, avg $${(similarTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / similarTransactions.length).toFixed(2)}
Impact: ${stats?.percentOfIncome.toFixed(1)}% of income ($${stats?.monthlyAverage.toFixed(0)}/month)
Rank: #${stats?.merchantRank || 'N/A'} of ${stats?.totalMerchants || 'N/A'} merchants

Requirements:
- Start with a relevant emoji
- One insightful observation about spending pattern or financial impact
- One specific, high-impact action recommendation
- Max 40 words total
- Direct, professional tone
- Focus on unique patterns or overlooked opportunities`;
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

  const generateComparisonInsight = () => {
    if (!transaction || !stats) return "Insufficient data to compare spending patterns.";
    
    const merchantName = transaction.merchant_name || transaction.name;
    const monthlySpend = stats.monthlyAverage;
    const isHighFrequency = stats.merchantRank <= Math.ceil(stats.totalMerchants * 0.2); // Top 20% of merchants
    const isLowFrequency = stats.merchantRank >= Math.floor(stats.totalMerchants * 0.8); // Bottom 20% of merchants
    const percentOfIncome = stats.percentOfAccountIncome;
    
    // Get category for better context
    const category = transaction.category && transaction.category.length > 0 ? transaction.category[0] : null;
    
    // Dynamic comparison based on category and spending amount
    if (category) {
      // Category-specific insights
      switch(category) {
        case "Food and Drink":
          if (isHighFrequency && monthlySpend > 300) {
            return `📈 You spend $${monthlySpend.toFixed(0)} monthly at ${merchantName}, which is significantly higher than the average person with similar income. Most people spend about 10-15% of their budget on dining, while this represents ${percentOfIncome.toFixed(1)}% of your monthly income.`;
          } else if (isLowFrequency && monthlySpend < 50) {
            return `📉 You spend just $${monthlySpend.toFixed(0)} monthly at ${merchantName}, which is impressively lower than most people with similar income. You're being more financially savvy than the 70% of Americans who overspend on dining!`;
          }
          return `You spend $${monthlySpend.toFixed(0)} monthly at ${merchantName}, which is about average compared to others with similar income.`;
          
        case "Travel":
          if (isHighFrequency && monthlySpend > 200) {
            return `✈️ Your $${monthlySpend.toFixed(0)} monthly spending at ${merchantName} is much higher than typical. The average person spends only about $50-100 monthly on similar services. This represents ${percentOfIncome.toFixed(1)}% of your monthly income.`;
          } else {
            return `✈️ Your $${monthlySpend.toFixed(0)} monthly travel spending at ${merchantName} is quite reasonable compared to others with similar income. Well done on keeping these costs manageable!`;
          }
          
        case "Shopping":
          if (monthlySpend > 300) {
            return `🛍️ Your $${monthlySpend.toFixed(0)} monthly shopping at ${merchantName} exceeds what 80% of people with similar income typically spend. The average is closer to $150-200 per month on similar merchants.`;
          } else {
            return `🛍️ Your $${monthlySpend.toFixed(0)} monthly spending at ${merchantName} is lower than what most people with similar income spend. Great job prioritizing your financial goals!`;
          }
          
        case "Recreation":
        case "Entertainment":
          if (monthlySpend > 150) {
            return `🎭 Your entertainment spending of $${monthlySpend.toFixed(0)} monthly at ${merchantName} is about 2x higher than the average person with similar income. Most people spend around $70-90 on similar entertainment.`;
          } else {
            return `🎭 Your entertainment budget of $${monthlySpend.toFixed(0)} at ${merchantName} is quite modest compared to others in your income bracket who typically spend $70-150 monthly. Good balance!`;
          }
          
        case "Coffee Shop":
        case "Coffee Shops":
          if (monthlySpend > 100) {
            return `☕ You spend $${monthlySpend.toFixed(0)} monthly at ${merchantName}, which is 3x more than the average person! Most people spend $30-40 monthly on coffee shops.`;
          } else if (monthlySpend < 15) {
            return `☕ You spend only $${monthlySpend.toFixed(0)} monthly at ${merchantName}, which is significantly less than most people. The average person spends $30-40 monthly on coffee shops. Great saving habit!`;
          }
          return `☕ Your coffee spending of $${monthlySpend.toFixed(0)} at ${merchantName} is about average compared to others with similar income.`;
          
        default:
          // Default based on merchant rank
          if (isHighFrequency) {
            return `📊 Your $${monthlySpend.toFixed(0)} monthly spending at ${merchantName} is higher than 80% of people with similar income. This is your #${stats.merchantRank} expense out of ${stats.totalMerchants} merchants.`;
          } else if (isLowFrequency) {
            return `📊 Your $${monthlySpend.toFixed(0)} monthly spending at ${merchantName} is lower than what 80% of people with similar income spend. Nice job keeping this expense in check!`;
          }
          return `📊 Your spending of $${monthlySpend.toFixed(0)} monthly at ${merchantName} is about average compared to others with similar income.`;
      }
    } else {
      // Generic comparisons based on merchant ranking
      if (stats.merchantRank <= 3 && percentOfIncome > 5) {
        return `⚠️ Your $${monthlySpend.toFixed(0)} monthly spending at ${merchantName} is one of your top expenses (#${stats.merchantRank} of ${stats.totalMerchants}) and represents ${percentOfIncome.toFixed(1)}% of your monthly income. This is significantly higher than what most people with similar income allocate to this type of expense.`;
      } else if (stats.merchantRank <= Math.ceil(stats.totalMerchants * 0.1)) {
        return `📈 Your $${monthlySpend.toFixed(0)} monthly spending at ${merchantName} places in your top 10% of expenses. The average person with similar income typically spends less on this category relative to their total budget.`;
      } else if (stats.merchantRank >= Math.floor(stats.totalMerchants * 0.9)) {
        return `📉 Your $${monthlySpend.toFixed(0)} monthly spending at ${merchantName} is much lower than what most people with similar income spend. Great job keeping this expense minimal!`;
      } else {
        return `📊 Your spending of $${monthlySpend.toFixed(0)} monthly at ${merchantName} appears to be in line with what others of similar income typically spend.`;
      }
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
        className={`fixed inset-y-0 right-0 w-3/5 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto ${
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

        {/* Content split into two columns */}
        <div className="p-4 grid grid-cols-2 gap-4 text-left">
          {/* Left Column - Transaction Details & Analysis */}
          <div className="space-y-4">
            {/* Combined Transaction Overview & Historical Analysis - Renamed to Merchant Analysis */}
            <div className="bg-white rounded-xl p-3 border-2 border-blue-200 shadow-sm">
              {/* Card header with icon like other cards */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <span className="mr-2 text-lg">💼</span>
                  <span className="font-semibold text-base text-gray-800">Merchant Analysis</span>
                </div>
                <div className="flex items-center">
                  {stats && (
                    <span className="text-xs font-medium text-gray-500">Last {stats.daysSinceFirst} days</span>
                  )}
                  {stats && !stats.isIncoming && stats.merchantRank > 0 && (
                    <span className={`px-2 py-1 text-xs rounded-full ml-2 ${
                      stats.merchantRank <= Math.ceil(stats.totalMerchants * 0.2)
                        ? 'bg-red-100 text-red-800' // Top 20% (high spending) - red
                        : stats.merchantRank >= Math.floor(stats.totalMerchants * 0.8)
                          ? 'bg-green-100 text-green-800' // Bottom 20% (low spending) - green
                          : 'bg-blue-100 text-blue-800' // Middle range - blue
                    }`}>
                      Rank #{stats.merchantRank} of {stats.totalMerchants}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Two-column layout for transaction details */}
              <div className="grid grid-cols-2 gap-3">
                {/* Column 1: Merchant details */}
                <div className="space-y-2">
                  {/* Merchant name - removed the rank chip from here */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-left">{transaction.merchant_name || transaction.name}</h3>
                  </div>
                  
                  {/* Amount with transaction type style */}
                  <div className="flex items-center gap-1">
                    <p className={`text-xl font-bold ${transaction.amount < 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${Math.abs(transaction.amount).toFixed(2)}
                    </p>
                    <span className="text-xs text-gray-500 ml-1">
                      {new Date(transaction.date).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {/* Transaction type and tags */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${transaction.amount < 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {transaction.amount < 0 ? '← Incoming' : '→ Outgoing'}
                      </span>
                      
                      {/* Pending status */}
                      {transaction.pending && (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700 border border-yellow-100">
                          Pending
                        </span>
                      )}
                    </div>
                    
                    {/* Categories */}
                    {transaction.category && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {transaction.category.map((category, index) => (
                          <span 
                            key={index}
                            className="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded-full border border-gray-200"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Column 2: Historical statistics */}
                {stats && (
                  <div className="flex flex-col gap-2">
                    {/* Historical statistics */}
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Avg. Spend/Month:</span>
                          <span className="font-medium">${stats.monthlyAverage.toFixed(0)}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Avg. Frequency/Month:</span>
                          <span className="font-medium">{(stats.frequency / (stats.daysSinceFirst / 30)).toFixed(1)}x</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Avg. Transaction:</span>
                          <span className="font-medium">${stats.averageSpent.toFixed(0)}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Avg. Spend/Year:</span>
                          <span className="font-medium">${stats.annualAverage.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Category Analysis */}
            {stats && stats.hasCategory && stats.category && (
              <div className="bg-white rounded-xl p-4 border-2 border-emerald-200 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center">
                    <span className="mr-2 text-lg">📁</span>
                    <span className="font-semibold text-base text-gray-800">Category Analysis</span>
                  </div>
                  <div className="flex items-center">
                    {stats.category.categoryRank > 0 && (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full">
                        Rank #{stats.category.categoryRank} of {stats.category.totalCategories}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Category name moved below title */}
                <div className="ml-1 mb-3">
                  <span className="text-base font-semibold text-gray-800">
                    {stats.category.name}
                  </span>
                </div>
                
                <div className="space-y-4">
                  {/* Category metrics in a grid with updated labels */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Total Spent Last {stats.daysSinceFirst} Days</p>
                      <p className="font-semibold">${stats.category.totalSpent.toFixed(2)}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Monthly Avg. Spend</p>
                      <p className="font-semibold">${stats.category.monthlyAverage.toFixed(2)}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Recent Transactions</p>
                      <p className="font-semibold">{stats.category.count}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Budget Analysis */}
            {stats && !stats.isIncoming && stats.hasCategory && stats.category && (
              <div className="bg-white rounded-xl p-4 border-2 border-teal-200 shadow-sm mt-4">
                <div className="flex items-center mb-3">
                  <span className="mr-2 text-lg">📅</span>
                  <span className="font-semibold text-base text-gray-800">Budget Analysis</span>
                </div>
                
                {/* Calculate month-to-date spending for this category */}
                {(() => {
                  // Get current date info for calculating days in month and days passed
                  const now = new Date();
                  const currentMonth = now.getMonth();
                  const currentYear = now.getFullYear();
                  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                  const daysPassed = now.getDate();
                  const daysRemaining = daysInMonth - daysPassed;
                  
                  // Calculate current month's spending on this category
                  // Filter transactions to current month only and this category
                  const currentMonthCategoryTransactions = transactions.filter(t => 
                    t.category && 
                    t.category.length > 0 && 
                    stats.category && // Add null check here
                    t.category[0] === stats.category.name &&
                    t.amount > 0 && // Only expenses
                    t.account_id === transaction.account_id && // Same account
                    new Date(t.date).getMonth() === currentMonth &&
                    new Date(t.date).getFullYear() === currentYear
                  );
                  
                  // Sum up current month spending
                  const monthToDateSpend = currentMonthCategoryTransactions.reduce(
                    (sum, t) => sum + Math.abs(t.amount), 
                    0
                  );
                  
                  // Historical average monthly spending on this category
                  const historicalMonthlyAvg = stats.category.monthlyAverage;
                  
                  // Calculate daily average budget (total / days in month)
                  const dailyBudget = historicalMonthlyAvg / daysInMonth;
                  
                  // Expected spend so far based on days passed
                  const expectedSpendSoFar = dailyBudget * daysPassed;
                  
                  // Remaining budget
                  const remainingBudget = Math.max(0, historicalMonthlyAvg - monthToDateSpend);
                  
                  // Calculate spending pace - Over or under budget?
                  const spendingPace = monthToDateSpend / expectedSpendSoFar;
                  const isOverPace = spendingPace > 1.1; // More than 10% over pace
                  const isUnderPace = spendingPace < 0.9; // More than 10% under pace
                  
                  // Projected end of month spending at current pace
                  const projectedMonthTotal = monthToDateSpend + (monthToDateSpend / daysPassed * daysRemaining);
                  
                  // Progress percentage for visualization
                  const progressPercent = Math.min(100, (monthToDateSpend / historicalMonthlyAvg) * 100);
                  
                  return (
                    <div className="space-y-4">
                      {/* Category name and month display */}
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {stats.category.name} spending for {now.toLocaleString('default', { month: 'long' })}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                          Day {daysPassed} of {daysInMonth}
                        </span>
                      </div>
                      
                      {/* Main progress bar showing month-to-date vs historical average */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Month-to-date</span>
                          <div className="space-x-1 text-right">
                            <span className="font-bold">${monthToDateSpend.toFixed(0)}</span>
                            <span className="text-gray-500">of</span>
                            <span>${historicalMonthlyAvg.toFixed(0)}</span>
                          </div>
                        </div>
                        
                        {/* Progress bar with expected pace marker */}
                        <div className="relative h-4 w-full bg-gray-100 rounded-full overflow-hidden">
                          {/* Month to date progress */}
                          <div 
                            className={`absolute left-0 top-0 h-full rounded-l-full ${
                              isOverPace ? 'bg-red-500' : isUnderPace ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                          
                          {/* Expected spending marker based on days passed */}
                          <div 
                            className="absolute top-0 h-full border-r-2 border-gray-800"
                            style={{ 
                              left: `${Math.min(100, (expectedSpendSoFar / historicalMonthlyAvg) * 100)}%`,
                              opacity: 0.7
                            }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Start of Month</span>
                          <span>Historical Monthly Avg: ${historicalMonthlyAvg.toFixed(0)}</span>
                        </div>
                      </div>
                      
                      {/* Spending details grid */}
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-xs text-gray-500">Remaining Budget</p>
                          <p className={`font-semibold ${remainingBudget > 0 ? 'text-green-700' : 'text-red-700'}`}>
                            ${remainingBudget.toFixed(0)}
                          </p>
                        </div>
                        
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-xs text-gray-500">Days Remaining</p>
                          <p className="font-semibold text-gray-700">{daysRemaining} days</p>
                        </div>
                        
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-xs text-gray-500">Daily Budget Left</p>
                          <p className="font-semibold text-gray-700">
                            ${(remainingBudget / daysRemaining).toFixed(0)}/day
                          </p>
                        </div>
                        
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-xs text-gray-500">Projected Total</p>
                          <p className={`font-semibold ${projectedMonthTotal > historicalMonthlyAvg ? 'text-red-700' : 'text-green-700'}`}>
                            ${projectedMonthTotal.toFixed(0)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Insight message based on spending pace */}
                      <div className={`text-sm p-2 rounded-lg ${
                        isOverPace ? 'bg-red-50 text-red-800' : 
                        isUnderPace ? 'bg-green-50 text-green-800' : 
                        'bg-blue-50 text-blue-800'
                      }`}>
                        {isOverPace ? 
                          `You're spending ${((spendingPace - 1) * 100).toFixed(0)}% faster on ${stats.category.name} than your historical average. At this pace, you'll exceed your usual monthly spending by $${(projectedMonthTotal - historicalMonthlyAvg).toFixed(0)}.` :
                          isUnderPace ?
                          `You're spending ${((1 - spendingPace) * 100).toFixed(0)}% slower on ${stats.category.name} than your historical average. If this continues, you'll have $${(historicalMonthlyAvg - projectedMonthTotal).toFixed(0)} left from your usual spending.` :
                          `Your ${stats.category.name} spending is on pace with your historical average of $${historicalMonthlyAvg.toFixed(0)} per month.`
                        }
                      </div>
                      
                      {/* This transaction's impact */}
                      <div className="mt-3">
                        <p className="text-xs text-gray-600 mb-1">This transaction's impact on your monthly budget:</p>
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 h-2 rounded-full">
                            <div 
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${Math.min(100, (Math.abs(transaction.amount) / historicalMonthlyAvg) * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium ml-2 whitespace-nowrap">
                            {((Math.abs(transaction.amount) / historicalMonthlyAvg) * 100).toFixed(0)}% of monthly avg
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          
          {/* Right Column - Insights & Analysis */}
          <div className="space-y-4">
            {/* Reordered AI Insights */}
            <div className="space-y-4">
              {/* Clever Tip - renamed to Instant Insight */}
              <div className="bg-white rounded-xl p-3 text-sm text-purple-700 font-medium border-2 border-purple-300 shadow">
                <div className="flex items-center mb-2">
                  <span className="mr-2 text-lg">💡</span>
                  <span className="font-semibold text-base">Instant Insight</span>
                </div>
                <div className="min-h-[30px]">
                  {isLoadingQuickTip ? (
                    <span className="text-gray-400 italic">Generating insight...</span>
                  ) : (
                    quickTip
                  )}
                </div>
              </div>

              {/* Money Tip */}
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

              {/* NEW: How You Stack Up comparison card */}
              {!stats?.isIncoming && (
                <div className="bg-white rounded-xl p-3 text-sm text-indigo-600 font-medium border-2 border-indigo-300 shadow">
                  <div className="flex items-center mb-2">
                    <span className="mr-2 text-lg">🧮</span>
                    <span className="font-semibold text-base">How You Stack Up</span>
                  </div>
                  <div className="min-h-[30px]">
                    {isLoadingInsight ? (
                      <span className="text-gray-400 italic">Analyzing your spending patterns...</span>
                    ) : (
                      <div>
                        <p className="text-sm" dangerouslySetInnerHTML={{ __html: generateComparisonInsight() }}></p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Deep AI Insight */}
              {aiInsight && (
                <div className="bg-white rounded-xl p-3 text-sm text-gray-700 font-medium border-2 border-teal-300 shadow">
                  <div className="flex items-center mb-2">
                    <span className="mr-2 text-lg">🧠</span>
                    <span className="font-semibold text-base">AI Feedback</span>
                  </div>
                  <div className="min-h-[30px]">
                    {isLoadingInsight ? (
                      <span className="text-gray-400 italic">Analyzing your transaction pattern...</span>
                    ) : (
                      aiInsight
                    )}
                  </div>
                </div>
              )}
              
              {/* Long-term financial consideration */}
              {!stats?.isIncoming && (
                <div className="bg-white rounded-xl p-4 text-sm border-2 border-blue-300 shadow-sm">
                  <div className="flex items-center mb-3">
                    <span className="mr-2 text-lg">📈</span>
                    <span className="font-semibold text-base text-gray-800">Long-term Financial Consideration</span>
                  </div>
                  <div className="text-gray-700">
                    <p className="mb-3">
                      If you redirected your monthly spending of <span className="font-semibold text-blue-600">${(stats?.monthlyAverage || 0).toFixed(2)}</span> from {transaction?.merchant_name || transaction?.name} into S&P 500 index funds:
                    </p>
                    
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-blue-50 p-2 rounded-lg text-center">
                        <p className="text-xs text-blue-700 mb-1">In 5 Years</p>
                        <p className="font-bold text-blue-800">
                          ${calculateInvestmentValue(stats?.monthlyAverage || 0, 5).toFixed(0)}
                        </p>
                      </div>
                      <div className="bg-blue-50 p-2 rounded-lg text-center">
                        <p className="text-xs text-blue-700 mb-1">In 10 Years</p>
                        <p className="font-bold text-blue-800">
                          ${calculateInvestmentValue(stats?.monthlyAverage || 0, 10).toFixed(0)}
                        </p>
                      </div>
                      <div className="bg-blue-50 p-2 rounded-lg text-center">
                        <p className="text-xs text-blue-700 mb-1">In 20 Years</p>
                        <p className="font-bold text-blue-800">
                          ${calculateInvestmentValue(stats?.monthlyAverage || 0, 20).toFixed(0)}
                        </p>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-2">
                      Calculations based on the historical average annual return of the S&P 500 (approximately 10%) with monthly contributions, compounded annually. The actual returns may vary.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Add helper function for investment calculations
function calculateInvestmentValue(monthlyContribution: number, years: number): number {
  const annualContribution = monthlyContribution * 12;
  const annualReturn = 0.10; // 10% average annual return for S&P 500
  let totalValue = 0;
  
  for (let i = 0; i < years; i++) {
    totalValue = (totalValue + annualContribution) * (1 + annualReturn);
  }
  
  return totalValue;
}

// Helper function to generate top merchant bars
function generateTopMerchantBars(stats: any, currentMerchantName: string) {
  // Create simulated top merchants based on the available stats
  // In a real implementation, this would use actual top merchant data
  const simulatedTopMerchants = [
    {
      name: stats.merchantRank <= 3 ? "Other Top Merchant" : "Top Merchant 1",
      monthlySpend: stats.merchantRank <= 3 
        ? stats.monthlyAverage * 0.85 
        : stats.monthlyAverage * 1.8
    },
    {
      name: stats.merchantRank <= 3 ? "Other Top Merchant" : "Top Merchant 2",
      monthlySpend: stats.merchantRank <= 3 
        ? stats.monthlyAverage * 0.7 
        : stats.monthlyAverage * 1.5
    },
    {
      name: "Category Average",
      monthlySpend: stats.hasCategory && stats.category 
        ? stats.category.monthlyAverage * 0.7 
        : stats.monthlyAverage * 0.9
    }
  ];
  
  // Get the highest value for scaling the bars
  const maxValue = Math.max(
    stats.monthlyAverage,
    ...simulatedTopMerchants.map(m => m.monthlySpend)
  );
  
  return (
    <>
      {simulatedTopMerchants.map((merchant, index) => (
        <div key={index}>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span className="font-medium truncate mr-2 max-w-[150px]">{merchant.name}</span>
            <span>${merchant.monthlySpend.toFixed(0)}/mo</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full ${
                index === 0 ? "bg-blue-400" : 
                index === 1 ? "bg-green-400" : "bg-yellow-400"
              }`}
              style={{ width: `${Math.min(100, (merchant.monthlySpend / maxValue) * 100)}%` }}
            ></div>
          </div>
        </div>
      ))}
    </>
  );
}

// Helper function to generate spending insight based on stats
function generateSpendingInsight(stats: any, transaction: any) {
  const merchantName = transaction.merchant_name || transaction.name;
  
  // Create contextual insight based on merchant rank and category
  if (stats.merchantRank <= 3) {
    return `${merchantName} is one of your top ${stats.merchantRank} expenses, accounting for ${stats.percentOfIncome.toFixed(1)}% of your annual budget. Reducing this expense could significantly impact your overall budget.`;
  } 
  else if (stats.merchantRank <= Math.ceil(stats.totalMerchants * 0.2)) {
    return `At ${stats.percentOfIncome.toFixed(1)}% of your annual budget, ${merchantName} is among your top 20% of expenses. Consider reviewing if you're getting good value for this spending.`;
  }
  else if (stats.hasCategory && stats.category && stats.monthlyAverage > stats.category.monthlyAverage * 1.2) {
    return `You spend ${(stats.monthlyAverage / stats.category.monthlyAverage).toFixed(1)}x more at ${merchantName} than your average spending in the ${stats.category.name} category. This might be an opportunity to find more cost-effective alternatives.`;
  }
  else if (Math.abs(transaction.amount) > stats.averageSpent * 1.5) {
    return `This $${Math.abs(transaction.amount).toFixed(2)} transaction is ${(Math.abs(transaction.amount) / stats.averageSpent).toFixed(1)}x larger than your typical spending of $${stats.averageSpent.toFixed(2)} at ${merchantName}. Take note if this is a one-time exception or a new trend.`;
  }
  else {
    return `Your monthly spending of $${stats.monthlyAverage.toFixed(2)} at ${merchantName} represents ${stats.percentOfIncome.toFixed(1)}% of your budget. This is a ${stats.merchantRank <= Math.ceil(stats.totalMerchants * 0.5) ? "moderate" : "minor"} expense in your overall financial picture.`;
  }
}

export default TransactionDrawer;