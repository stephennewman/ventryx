import { getFirestore, collection, doc, writeBatch } from 'firebase/firestore';
import { plaidClient } from '../config/plaid';

/**
 * Syncs transactions for a specific user
 * @param {string} userId - The user ID
 * @param {string} accessToken - The Plaid access token
 * @param {Object} options - Optional parameters
 * @param {string} options.startDate - Start date (YYYY-MM-DD)
 * @param {string} options.endDate - End date (YYYY-MM-DD)
 * @param {boolean} options.saveToDb - Whether to save transactions to database
 * @returns {Promise<Object>} - The transactions and accounts
 */
export async function syncTransactionsForUser(userId: string, accessToken: string, options: {
  startDate?: string;
  endDate?: string;
  saveToDb?: boolean;
} = {}) {
  if (!userId || !accessToken) {
    throw new Error('User ID and access token are required');
  }
  
  const today = new Date();
  const startDate = options.startDate || 
    new Date(today.setDate(today.getDate() - 30)).toISOString().split('T')[0];
  const endDate = options.endDate || new Date().toISOString().split('T')[0];
  const saveToDb = options.saveToDb !== undefined ? options.saveToDb : true;
  
  try {
    // Use Plaid SDK to get transactions
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: 100 }
    });
    
    const { transactions, accounts } = response.data;
    
    // Save to database if requested
    if (saveToDb) {
      const db = getFirestore();
      
      // Create a batch to handle multiple writes
      const batch = writeBatch(db);
      
      // Save transactions
      if (transactions && transactions.length > 0) {
        transactions.forEach(transaction => {
          const userRef = doc(db, 'users', userId);
          const txRef = doc(collection(userRef, 'transactions'), transaction.transaction_id);
          batch.set(txRef, {
            ...transaction,
            synced_at: new Date().toISOString()
          });
        });
      }
      
      // Save accounts
      if (accounts && accounts.length > 0) {
        accounts.forEach(account => {
          const userRef = doc(db, 'users', userId);
          const accRef = doc(collection(userRef, 'accounts'), account.account_id);
          batch.set(accRef, {
            ...account,
            synced_at: new Date().toISOString()
          });
        });
      }
      
      await batch.commit();
      console.log(`Synced ${transactions?.length || 0} transactions and ${accounts?.length || 0} accounts for user ${userId}`);
    }
    
    return { transactions, accounts };
  } catch (error) {
    console.error('Error syncing transactions:', error);
    throw error;
  }
} 