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

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category);
  };

  const handleVendorClick = (vendor: string) => {
    setSelectedVendor(vendor === selectedVendor ? null : vendor);
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesCategory = selectedCategory ? transaction.category.includes(selectedCategory) : true;
    const matchesVendor = selectedVendor ? (transaction.merchant_name || transaction.name) === selectedVendor : true;
    return matchesCategory && matchesVendor;
  });

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

  return (
    <div className="space-y-4">
      {selectedCategory || selectedVendor ? (
        <div className={`p-4 rounded-lg shadow-md flex justify-between items-start ${totalAmount < 0 ? 'bg-green-100' : 'bg-red-100'}`}>
          <div className="text-left">
            <p className="text-sm text-gray-700">Transactions: {transactionCount}</p>
            <p className="text-sm text-gray-700">Average Amount: ${averageAmount.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-700">Last {daysWorth} days</p>
            <h4 className={`text-lg font-semibold ${totalAmount < 0 ? 'text-green-800' : 'text-red-800'}`}>Total Amount: ${totalAmount.toFixed(2)}</h4>
          </div>
        </div>
      ) : null}
      {filteredTransactions.map((transaction) => (
        <div
          key={transaction.transaction_id}
          className="bg-white p-2 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex justify-between items-center">
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center">
                <h4
                  onClick={() => handleVendorClick(transaction.merchant_name || transaction.name)}
                  className={`text-lg font-semibold text-gray-900 truncate text-left cursor-pointer ${selectedVendor === (transaction.merchant_name || transaction.name) ? 'underline' : ''}`}
                >
                  {transaction.merchant_name || transaction.name}
                </h4>
                {transaction.category && (
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