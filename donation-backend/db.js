// Firebase Admin Initialization
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let db = null;

const connectDB = async () => {
    try {
        // Option 1: Provide path to service account key file
        const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
        
        // Option 2: Provide config via ENV vars
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✓ Firebase Admin initialized with serviceAccountKey.json');
        } else if (projectId && clientEmail && privateKey) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey
                })
            });
            console.log('✓ Firebase Admin initialized with environment variables');
        } else {
            console.error('✗ Firebase credentials missing. Please provide serviceAccountKey.json or set ENV variables.');
            return false;
        }

        db = admin.firestore();
        return true;
    } catch (error) {
        if (error.code === 'app/duplicate-app') {
            db = admin.firestore();
            console.log('✓ Firebase Admin already initialized');
            return true;
        }
        console.error('✗ Firebase connection failed:', error.message);
        return false;
    }
};

const getDB = () => {
    if (!db) {
        throw new Error('Firebase Firestore not initialized');
    }
    return db;
};

module.exports = { connectDB, getDB, admin };
