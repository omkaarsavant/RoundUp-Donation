const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// Note: Using relative paths for logos. The frontend should handle prepending the API_BASE_URL if needed,
// but for easiest compatibility with current frontend img src usage, we'll use a placeholder or relative slash.
const ngos = [
    {
        name: "Samagra Foundation",
        description: "A non-profit organization working on education, health, environment, and community empowerment for marginalized communities. It runs initiatives like informal learning centers, youth empowerment programs, and rural education projects.",
        logo: "samagra.jpg",
        category: "Education & Health",
        upiId: "samagra@upi",
        website: "https://samagrafoundation.com/",
        location: "Nashik",
        phone: "7588539018"
    },
    {
        name: "Nashik Ploggers",
        description: "A volunteer group focused on environmental cleanliness and plastic waste reduction. They organize plogging drives (jogging while collecting waste) and public awareness campaigns about sustainability in Nashik.",
        logo: "np.jpg",
        category: "Environment",
        upiId: "nashikploggers@upi",
        website: "https://www.ploggersfoundation.org/",
        location: "Nashik",
        phone: "9067355268"
    },
    {
        name: "Akshar Paaul",
        description: "A social trust dedicated to providing education to children of migrant construction workers and helping them enter mainstream schooling through literacy programs and learning centers.",
        logo: "akshar.jpg",
        category: "Education",
        upiId: "aksharpaaul@upi",
        website: "https://www.aksharpaaul.org/",
        location: "Pune",
        phone: "8856935553"
    },
    {
        name: "Janaseva Foundation",
        description: "A well-known nonprofit working in healthcare, education, elderly care, and social welfare. It runs hospitals, rehabilitation services, and community development programs for vulnerable groups.",
        logo: "janaseva.jpg",
        category: "Healthcare & Welfare",
        upiId: "janaseva@upi",
        website: "https://janasevafoundation.org/",
        location: "Pune",
        phone: "+91 20 24538787"
    },
    {
        name: "Abhilasha Foundation",
        description: "A social organization working for women empowerment, child welfare, and community development through awareness programs, education initiatives, and support for disadvantaged groups.",
        logo: "abhilasja.jpg",
        category: "Women & Child Welfare",
        upiId: "abhilasha@upi",
        website: "https://www.abhilasha-foundation.org/",
        location: "Mumbai",
        phone: "+91 98702 34440"
    }
];

async function seedNGOs() {
    console.log('Clearing existing NGOs from Firestore...');
    const snapshot = await db.collection('ngos').get();
    const deleteBatch = db.batch();
    snapshot.forEach(doc => {
        deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    console.log('Cleared existing NGOs.');

    console.log('Seeding new NGOs into Firestore...');
    const batch = db.batch();
    
    for (const ngo of ngos) {
        const docRef = db.collection('ngos').doc();
        batch.set(docRef, {
            ...ngo,
            id: docRef.id,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    await batch.commit();
    console.log('Successfully seeded 5 new NGOs with local assets.');
}

seedNGOs().catch(console.error);
