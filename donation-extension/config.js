// Firebase Configuration for Chrome Extension
import { initializeApp, getAuth, getFirestore } from './libs/firebase.js';

// Replace these with the actual Firebase config provided by the user
const firebaseConfig = {
    apiKey: "AIzaSyBMM7shaCD7z9wTxAPxqA3JuBhsWm563Os",
    authDomain: "roundup-donation.firebaseapp.com",
    projectId: "roundup-donation",
    storageBucket: "roundup-donation.firebasestorage.app",
    messagingSenderId: "547040678375",
    appId: "1:547040678375:web:19bd272585b3b1e18bad42",
    measurementId: "G-CV2JNEDLCE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
