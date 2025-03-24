const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function resetUser(email) {
  try {
    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // Delete user document from Firestore
    await db.collection('users').doc(userRecord.uid).delete();
    
    console.log(`Successfully reset onboarding state for user: ${email}`);
  } catch (error) {
    console.error('Error resetting user:', error);
  } finally {
    // Exit the process
    process.exit();
  }
}

// Get email from command line argument
const email = process.argv[2];
if (!email) {
  console.error('Please provide an email address as an argument');
  process.exit(1);
}

resetUser(email); 