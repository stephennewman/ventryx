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

      const stats = calculateMerchantStats();

      const messages = [{
        role: 'user',
        content: `Analyze this transaction and provide helpful insights with relevant links:

Transaction:
- Merchant: ${merchantName}
- Amount: $${Math.abs(transaction.amount)}
- Category: ${transaction.category?.join(', ')}
- Date: ${new Date(transaction.date).toLocaleDateString()}

Your Spending Pattern:
- Frequency: ${similarTransactions.length} transactions at this merchant
- Your average spend: $${(similarTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / similarTransactions.length).toFixed(2)}
- Monthly spend at this merchant: $${stats?.monthlyAverage.toFixed(2)}

Please provide a comprehensive analysis with helpful links:

1. Transaction Analysis:
   - How does this compare to your typical spending here?
   - Any notable patterns or trends?
   - Is this amount within a normal range for this category?

2. Money-Saving Opportunities:
   - Current deals or promotions at ${merchantName}
   - Rewards programs or cashback opportunities
   - Better timing suggestions for future purchases
   - Alternative merchants with better value
   - Student, military, or other applicable discounts

3. Smart Shopping Tips:
   - Link to merchant's rewards program (if available)
   - Links to relevant coupon sites or deal aggregators
   - Price comparison tools for this category
   - Links to similar merchants' deals
   - Any relevant credit card rewards programs

4. Additional Resources:
   - Reviews or comparison sites for this merchant
   - Consumer protection or warranty information if relevant
   - Budgeting tips specific to this category
   - Links to relevant money-saving communities or forums

Format the response with:
- Bullet points for easy reading
- Markdown links for all URLs
- 3-4 concise, actionable insights
- Focus on practical, immediate value
- Include specific savings amounts when possible (e.g., "Save 15% with X program")

Keep the tone friendly and focus on actionable opportunities to save money or get better value.`
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
        className={`fixed inset-y-0 right-0 w-96 bg-gradient-to-br from-white via-purple-50 to-blue-50 shadow-xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-left">Transaction Analysis</h2>
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
            {stats && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <label className="text-sm text-gray-600 block font-medium">Analysis Last {stats.daysSinceFirst} Days</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Spent</p>
                    <p className="text-lg font-semibold">${stats.totalSpent.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Avg. Transaction</p>
                    <p className="text-lg font-semibold">${stats.averageSpent.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Avg. Monthly Spend</p>
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
              <div className="bg-purple-50 rounded-lg p-4">
                <label className="text-sm text-purple-800 block font-medium">AI Insight</label>
                <div className="text-sm text-purple-900 mt-1">
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
                      className="px-2 py-1 bg-gradient-to-r from-purple-100 via-pink-100 to-blue-100 text-purple-900 text-sm rounded-full"
                    >
                      {category}
                    </span>
                  ))}
                </div>
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