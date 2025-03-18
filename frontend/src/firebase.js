// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBK-r9INUz-Z6r-8hMgRv9O0mcR4qIhvQk",
  authDomain: "ventryx-71b2a.firebaseapp.com",
  projectId: "ventryx-71b2a",
  storageBucket: "ventryx-71b2a.firebasestorage.app",
  messagingSenderId: "339687895787",
  appId: "1:339687895787:web:12ca62a104cdc18a6b44ae",
  measurementId: "G-HZGWR3ZQVD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Google Sign-In function
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    console.log("User signed in: ", result.user);
    return result.user;
  } catch (error) {
    console.error("Error signing in: ", error);
  }
};

// Sign-out function
export const logOut = async () => {
  try {
    await signOut(auth);
    console.log("User signed out");
  } catch (error) {
    console.error("Error signing out: ", error);
  }
};

export { auth };
