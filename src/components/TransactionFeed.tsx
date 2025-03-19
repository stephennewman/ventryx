import React from 'react';
import { Transaction } from '../plaid';

interface TransactionFeedProps {
  transactions: Transaction[];
}

const TransactionFeed: React.FC<TransactionFeedProps> = ({ transactions }) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = React.useState<string | null>(null);
  const [totalAmount, setTotalAmount] = React.useState<number>(0);
  const [transactionCount, setTransactionCount] = React.useState<number>(0);
  const [averageAmount, setAverageAmount] = React.useState<number>(0);
  const [daysWorth, setDaysWorth] = React.useState<number>(0);
  const maxTransactionAmount = Math.max(...transactions.map(transaction => Math.abs(transaction.amount)));
  const totalWithdrawals = transactions.reduce((sum, transaction) => transaction.amount > 0 ? sum + transaction.amount : sum, 0);

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category);
  };

  const handleVendorClick = (vendor: string) => {
    setSelectedVendor(vendor === selectedVendor ? null : vendor);
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesCategory = selectedCategory === '$' ? transaction.amount < 0 : selectedCategory === '-$' ? transaction.amount > 0 : selectedCategory ? transaction.category.includes(selectedCategory) : true;
    const matchesVendor = selectedVendor ? (transaction.merchant_name || transaction.name) === selectedVendor : true;
    return matchesCategory && matchesVendor;
  });

  const maxFilteredTransactionAmount = Math.max(...filteredTransactions.map(transaction => Math.abs(transaction.amount)));

  React.useEffect(() => {
    const total = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    setTotalAmount(total);
    setTransactionCount(filteredTransactions.length);
    setAverageAmount(filteredTransactions.length > 0 ? total / filteredTransactions.length : 0);

    if (filteredTransactions.length > 0) {
      const earliestTransactionDate = new Date(Math.min(...filteredTransactions.map(transaction => new Date(transaction.date).getTime())));
      const today = new Date();
      const timeDiff = Math.abs(today.getTime() - earliestTransactionDate.getTime());
      setDaysWorth(Math.ceil(timeDiff / (1000 * 3600 * 24)));
    } else {
      setDaysWorth(0);
    }
  }, [filteredTransactions]);

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedVendor(null);
  };

  const totalWithdrawalAmount = filteredTransactions.reduce((sum, transaction) => transaction.amount > 0 ? sum + transaction.amount : sum, 0);
  const withdrawalCount = filteredTransactions.filter(transaction => transaction.amount > 0).length;

  const totalDepositAmount = filteredTransactions.reduce((sum, transaction) => transaction.amount < 0 ? sum + Math.abs(transaction.amount) : sum, 0);
  const depositCount = filteredTransactions.filter(transaction => transaction.amount < 0).length;

  const lastXDays = filteredTransactions.length > 0 ? Math.ceil((new Date().getTime() - new Date(Math.min(...filteredTransactions.map(transaction => new Date(transaction.date).getTime()))).getTime()) / (1000 * 3600 * 24)) : 0;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg shadow-md flex justify-between items-start bg-blue-50">
        <div className="text-left">
          {withdrawalCount > 0 && (
            <>
              <p className="text-sm text-gray-700">Transactions: {withdrawalCount}</p>
              <p className="text-sm text-gray-700">Average Transaction: ${withdrawalCount > 0 ? (totalWithdrawalAmount / withdrawalCount).toFixed(2) : '0.00'}</p>
            </>
          )}
          {depositCount > 0 && (
            <>
              <p className="text-sm text-gray-700">Deposits: {depositCount}</p>
              <p className="text-sm text-gray-700">Average Deposit: ${depositCount > 0 ? (totalDepositAmount / depositCount).toFixed(2) : '0.00'}</p>
            </>
          )}
          {lastXDays > 0 && (
            <p className="text-sm text-gray-700">Last {lastXDays} days</p>
          )}
        </div>
        <div className="text-right">
          {withdrawalCount > 0 && (
            <h4 className="text-lg font-semibold text-red-800">Total Transactions: ${totalWithdrawalAmount.toFixed(2)}</h4>
          )}
          {depositCount > 0 && (
            <h4 className="text-lg font-semibold text-green-800">Total Deposits: ${totalDepositAmount.toFixed(2)}</h4>
          )}
        </div>
      </div>
      {selectedCategory || selectedVendor ? (
        <div className="flex justify-end mb-4">
          <button
            onClick={clearFilters}
            className="text-blue-500 hover:underline focus:outline-none"
          >
            Clear Filters
          </button>
        </div>
      ) : null}
      {filteredTransactions.map((transaction) => (
        <div
          key={transaction.transaction_id}
          className="bg-white p-2 rounded-lg shadow-md hover:shadow-lg transition-shadow relative"
        >
          <div
            className={`absolute inset-y-0 left-0 ${transaction.amount < 0 ? 'bg-green-500' : 'bg-red-500'} opacity-20`}
            style={{ width: `${(Math.abs(transaction.amount) / maxFilteredTransactionAmount) * 100}%` }}
          />
          <div className="flex justify-between items-center relative z-10">
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center">
                <h4
                  onClick={() => handleVendorClick(transaction.merchant_name || transaction.name)}
                  className={`text-lg font-semibold text-gray-900 truncate text-left cursor-pointer ${selectedVendor === (transaction.merchant_name || transaction.name) ? 'underline' : ''}`}
                >
                  {transaction.merchant_name || transaction.name}
                </h4>
                {transaction.amount < 0 && (
                  <span
                    onClick={() => handleCategoryClick('$')}
                    className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full ml-2 cursor-pointer"
                  >
                    $
                  </span>
                )}
                {transaction.amount > 0 && (
                  <span
                    onClick={() => handleCategoryClick('-$')}
                    className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full ml-2 cursor-pointer"
                  >
                    -$
                  </span>
                )}
                {transaction.category && transaction.amount >= 0 && (
                  <div className="flex flex-wrap gap-2 ml-2">
                    {transaction.category.map((category, index) => (
                      <span
                        key={index}
                        onClick={() => handleCategoryClick(category)}
                        className={`px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full cursor-pointer ${selectedCategory === category ? 'bg-blue-300' : ''}`}
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="ml-4 flex-shrink-0 text-right">
              <p className="text-sm text-gray-600 mb-1">
                {new Date(transaction.date).toLocaleDateString()}
              </p>
              <p className={`text-lg font-semibold ${transaction.amount < 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(transaction.amount).toFixed(2)}
              </p>
              {transaction.pending && (
                <p className="text-sm text-orange-600 mt-1">Pending</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TransactionFeed; 