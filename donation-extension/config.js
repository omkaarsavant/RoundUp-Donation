// Firebase Configuration for Chrome Extension
import { initializeApp, getAuth, getFirestore } from './libs/firebase.js';

// Replace these with the actual Firebase config provided by the user
const firebaseConfig = {
    
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
