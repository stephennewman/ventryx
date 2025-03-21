import React, { useState } from 'react';
import { Transaction } from '../plaid';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FaCalendarAlt, FaSort } from 'react-icons/fa';

interface TransactionFeedProps {
  transactions: Transaction[];
  selectedAccountId: string | null;
}

// Custom input component for the date picker
const CustomDateInput = React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(({ onClick }, ref) => (
  <button className="p-2 border rounded flex items-center" onClick={onClick} ref={ref}>
    <FaCalendarAlt className="mr-2" />
  </button>
));

const TransactionFeed: React.FC<TransactionFeedProps> = ({ transactions, selectedAccountId }) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = React.useState<string | null>(null);
  const [totalAmount, setTotalAmount] = React.useState<number>(0);
  const [transactionCount, setTransactionCount] = React.useState<number>(0);
  const [averageAmount, setAverageAmount] = React.useState<number>(0);
  const [daysWorth, setDaysWorth] = React.useState<number>(0);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [dateRange, setDateRange] = React.useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;
  const maxTransactionAmount = Math.max(...transactions.map(transaction => Math.abs(transaction.amount)));
  const totalWithdrawals = transactions.reduce((sum, transaction) => transaction.amount > 0 ? sum + transaction.amount : sum, 0);
  const [sortOption, setSortOption] = useState<string>('date');

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category);
  };

  const handleVendorClick = (vendor: string) => {
    setSelectedVendor(vendor === selectedVendor ? null : vendor);
  };

  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOption(event.target.value);
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    switch (sortOption) {
      case 'amount-desc':
        return b.amount - a.amount;
      case 'amount-asc':
        return a.amount - b.amount;
      case 'date-asc':
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      case 'date-desc':
      default:
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
  });

  const filteredTransactions = sortedTransactions.filter(transaction => {
    const transactionDate = new Date(transaction.date);
    const isWithinDateRange = (!startDate || transactionDate >= startDate) &&
                              (!endDate || transactionDate <= endDate);
    const matchesSearch = (transaction.merchant_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          transaction.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === '$' ? transaction.amount < 0 : selectedCategory === '-$' ? transaction.amount > 0 : selectedCategory ? transaction.category.includes(selectedCategory) : true;
    const matchesVendor = selectedVendor ? (transaction.merchant_name || transaction.name) === selectedVendor : true;
    return matchesSearch && matchesCategory && matchesVendor && isWithinDateRange;
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

  const filteredWithdrawals = filteredTransactions.filter(transaction => transaction.amount > 0);
  const uniqueVendors = new Set(filteredWithdrawals.map(transaction => transaction.merchant_name || transaction.name)).size;

  const totalWithdrawalAmount = filteredWithdrawals.reduce((sum, transaction) => sum + transaction.amount, 0);
  const withdrawalCount = filteredWithdrawals.length;

  const averageWeeklyExpense = daysWorth > 0 ? (totalWithdrawalAmount / daysWorth) * 7 : 0;
  const averageMonthlyExpense = daysWorth > 0 ? (totalWithdrawalAmount / daysWorth) * 30 : 0;

  const lastXDays = filteredTransactions.length > 0 ? Math.ceil((new Date().getTime() - new Date(Math.min(...filteredTransactions.map(transaction => new Date(transaction.date).getTime()))).getTime()) / (1000 * 3600 * 24)) : 0;

  console.log('TransactionFeed - transactions prop:', transactions);
  console.log('TransactionFeed - filteredTransactions:', filteredTransactions);

  return (
    <div className="space-y-4">
      {withdrawalCount > 0 && (
        <div className="p-4 rounded-lg shadow-md flex justify-between items-start bg-blue-50">
          <div className="text-left">
            {lastXDays > 0 && (
              <p className="text-sm text-gray-700">Days Analyzed: {lastXDays}</p>
            )}
            <p className="text-sm text-gray-700"># of Transactions: {withdrawalCount}</p>
            <p className="text-sm text-gray-700"># of Unique Vendors: {uniqueVendors}</p>
            <p className="text-sm text-gray-700">Average Transaction: ${withdrawalCount > 0 ? (totalWithdrawalAmount / withdrawalCount).toFixed(2) : '0.00'}</p>
            <p className="text-sm text-gray-700">Average Weekly Spend: ${averageWeeklyExpense.toFixed(2)}</p>
            <p className="text-sm text-gray-700">Average Monthly Spend: ${averageMonthlyExpense.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <h4 className="text-lg font-semibold text-red-800">Total Spend: ${totalWithdrawalAmount.toFixed(2)}</h4>
          </div>
        </div>
      )}
      <div className="flex items-center space-x-4 mb-4">
        <input
          type="text"
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="p-2 border rounded flex-1"
        />
        <label htmlFor="sort" className="mr-2">Sort by:</label>
        <select id="sort" value={sortOption} onChange={handleSortChange} className="p-2 border rounded flex items-center">
          <FaSort className="mr-2" />
          <option value="date-desc">Date (Newest to Oldest)</option>
          <option value="date-asc">Date (Oldest to Newest)</option>
          <option value="amount-desc">Amount (Highest to Lowest)</option>
          <option value="amount-asc">Amount (Lowest to Highest)</option>
        </select>
        <DatePicker
          selectsRange={true}
          startDate={startDate}
          endDate={endDate}
          onChange={(update) => setDateRange(update)}
          isClearable={true}
          customInput={<CustomDateInput />}
          popperClassName="z-50"
        />
      </div>
      {selectedCategory || selectedVendor || selectedAccountId ? (
        <div className="p-2 border rounded mb-4">
          <button
            onClick={clearFilters}
            className="text-blue-500 hover:underline focus:outline-none w-full"
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
              <p className={`text-lg font-semibold ${transaction.amount < 0 ? 'text-green-600' : 'text-red-600'}`}
              >
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