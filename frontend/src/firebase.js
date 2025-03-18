// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);