const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkNGOs() {
    const snapshot = await db.collection('ngos').get();
    snapshot.forEach(doc => {
        console.log(`NGO: ${doc.data().name}, Logo: ${doc.data().logo}`);
    });
    process.exit(0);
}

checkNGOs().catch(console.error);
