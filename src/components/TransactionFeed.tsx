import React from 'react';
import { Transaction } from '../plaid';

interface TransactionFeedProps {
  transactions: Transaction[];
}

const TransactionFeed: React.FC<TransactionFeedProps> = ({ transactions }) => {
  return (
    <div className="space-y-4">
      {transactions.map((transaction) => (
        <div
          key={transaction.transaction_id}
          className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">
                {transaction.merchant_name || transaction.name}
              </h4>
              <p className="text-sm text-gray-600">
                {new Date(transaction.date).toLocaleDateString()}
              </p>
              {transaction.category && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {transaction.category.map((category, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p className={`text-lg font-semibold ${transaction.amount < 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(transaction.amount).toFixed(2)}
            </p>
          </div>
          {transaction.pending && (
            <p className="mt-2 text-sm text-orange-600">Pending</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default TransactionFeed; 