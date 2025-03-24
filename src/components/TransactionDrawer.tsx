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

  useEffect(() => {
    if (transaction && isOpen) {
      generateInsight();
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

      const messages = [{
        role: 'user',
        content: `Analyze this transaction at ${merchantName} for $${Math.abs(transaction.amount)}.
        
        Transaction details:
        - Date: ${new Date(transaction.date).toLocaleDateString()}
        - Category: ${transaction.category?.join(', ')}
        - Status: ${transaction.pending ? 'Pending' : 'Posted'}
        
        Historical context:
        - Total transactions at this merchant: ${similarTransactions.length}
        - Average transaction amount: $${(similarTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / similarTransactions.length).toFixed(2)}
        
        Please provide:
        1. Is this a typical amount for this merchant?
        2. Any unusual patterns or insights?
        3. Quick budgeting or money-saving tip related to this type of expense.
        
        Keep the response friendly and concise (2-3 sentences).`
      }];

      const response = await fetch('http://localhost:5176/api/openai/chat-with-transactions', {
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

  const calculateMerchantStats = () => {
    if (!transaction || !transactions) return null;

    const merchantName = transaction.merchant_name || transaction.name;
    const merchantTransactions = transactions.filter(t => 
      (t.merchant_name || t.name) === merchantName
    );

    const totalSpent = merchantTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const averageSpent = totalSpent / merchantTransactions.length;
    const frequency = merchantTransactions.length;
    const firstTransaction = new Date(Math.min(...merchantTransactions.map(t => new Date(t.date).getTime())));
    const daysSinceFirst = Math.ceil((new Date().getTime() - firstTransaction.getTime()) / (1000 * 3600 * 24));
    const monthlyAverage = (totalSpent / daysSinceFirst) * 30;

    return {
      totalSpent,
      averageSpent,
      frequency,
      monthlyAverage,
      daysSinceFirst
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
        <div className="border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-left">Transaction Details</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-left">
          <div>
            <h3 className="text-lg font-semibold text-left">{transaction.merchant_name || transaction.name}</h3>
            <p className={`text-2xl font-bold text-left ${transaction.amount < 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(transaction.amount).toFixed(2)}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 block">Date</label>
              <p className="text-gray-900">{new Date(transaction.date).toLocaleDateString()}</p>
            </div>

            <div>
              <label className="text-sm text-gray-600 block">Status</label>
              <p className="text-gray-900">{transaction.pending ? 'Pending' : 'Posted'}</p>
            </div>

            {transaction.category && (
              <div>
                <label className="text-sm text-gray-600 block">Categories</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {transaction.category.map((category, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {stats && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <label className="text-sm text-gray-600 block font-medium">Merchant Analysis</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Spent</p>
                    <p className="text-lg font-semibold">${stats.totalSpent.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Average Transaction</p>
                    <p className="text-lg font-semibold">${stats.averageSpent.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Monthly Average</p>
                    <p className="text-lg font-semibold">${stats.monthlyAverage.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Frequency</p>
                    <p className="text-lg font-semibold">{stats.frequency} times</p>
                  </div>
                </div>
              </div>
            )}

            {aiInsight && (
              <div className="bg-blue-50 rounded-lg p-4">
                <label className="text-sm text-blue-800 block font-medium">AI Insight</label>
                <div className="text-sm text-blue-900 mt-1">
                  {isLoadingInsight ? 'Generating insights...' : <ReactMarkdown>{aiInsight}</ReactMarkdown>}
                </div>
              </div>
            )}

            {transaction.location && (
              <div>
                <label className="text-sm text-gray-600 block">Location</label>
                <p className="text-gray-900">{[
                  transaction.location.address,
                  transaction.location.city,
                  transaction.location.state,
                  transaction.location.postal_code
                ].filter(Boolean).join(', ')}</p>
              </div>
            )}

            {transaction.payment_channel && (
              <div>
                <label className="text-sm text-gray-600 block">Payment Method</label>
                <p className="text-gray-900 capitalize">{transaction.payment_channel}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionDrawer; 