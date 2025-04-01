require('dotenv').config();
const admin = require('firebase-admin');
const { testWithRealData } = require('../testRealData');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Initialize Plaid
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.producion,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

async function runTest() {
  try {
    // Get the first user from Firestore who has a Plaid connection
    const plaidItemsSnapshot = await admin.firestore().collection('plaid_items').limit(1).get();
    
    if (plaidItemsSnapshot.empty) {
      console.error('No users found with Plaid connections');
      process.exit(1);
    }

    const plaidItemDoc = plaidItemsSnapshot.docs[0];
    const userId = plaidItemDoc.id;
    const accessToken = plaidItemDoc.data().access_token;

    // Log the userId and accessToken for debugging
    console.log('User ID:', userId);
    console.log('Access Token:', accessToken);

    // Get user details from Firebase
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    // Log the user data for debugging
    console.log('User Data:', userData);
    
    if (!userData || !userData.email) {
      console.error('User data not found');
      process.exit(1);
    }

    // Fetch transactions from Plaid
    const now = new Date();
    const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1));
    
    const transactionsResponse = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: oneMonthAgo.toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
    });

    // Run the test with real data
    await testWithRealData(
      transactionsResponse.data.transactions,
      userData.email,
      userData.displayName || 'Valued Customer'
    );

    console.log('Test completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error running test:', error);
    process.exit(1);
  }
}

runTest(); 