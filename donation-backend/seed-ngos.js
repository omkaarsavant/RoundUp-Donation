// Seed Initial NGO Data into Database
// Run once: node seed-ngos.js

const mongoose = require('mongoose');
require('dotenv').config();
const { NGO } = require('./models');

const seedNGOs = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(
            process.env.MONGODB_URI || 'mongodb://localhost:27017/donation-db',
            {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            }
        );

        console.log('✓ Connected to MongoDB\n');

        // Sample NGOs
        const ngos = [
            {
                id: 'ngo-001',
                name: 'Teach India Foundation',
                description: 'Providing quality education to underprivileged children across India',
                upiId: 'teachindia@upi',
                logo: 'https://via.placeholder.com/100?text=Teach+India',
                category: 'education',
                website: 'https://teachindia.org'
            },
            {
                id: 'ngo-002',
                name: 'Doctors Without Borders India',
                description: 'Medical aid and emergency healthcare to communities in need',
                upiId: 'dwbindia@upi',
                logo: 'https://via.placeholder.com/100?text=DWB',
                category: 'health',
                website: 'https://msf.org'
            },
            {
                id: 'ngo-003',
                name: 'Clean Environment Initiative',
                description: 'Working towards a cleaner, greener India through environmental conservation',
                upiId: 'cleanenv@upi',
                logo: 'https://via.placeholder.com/100?text=Clean+Env',
                category: 'environment',
                website: 'https://cleanindia.org'
            },
            {
                id: 'ngo-004',
                name: 'Hope for Every Child',
                description: 'Supporting underprivileged children\'s education, health, and welfare',
                upiId: 'hopechild@upi',
                logo: 'https://via.placeholder.com/100?text=Hope',
                category: 'poverty',
                website: 'https://hopechild.org'
            },
            {
                id: 'ngo-005',
                name: 'Disaster Relief Network',
                description: 'Emergency aid and rehabilitation for disaster-affected communities',
                upiId: 'drn.india@upi',
                logo: 'https://via.placeholder.com/100?text=DRN',
                category: 'disaster',
                website: 'https://disasterrelief.org'
            },
            {
                id: 'ngo-006',
                name: 'Women Empowerment Foundation',
                description: 'Empowering women through skill training and financial independence',
                upiId: 'womenpower@upi',
                logo: 'https://via.placeholder.com/100?text=Women+Power',
                category: 'other',
                website: 'https://womenempowerment.org'
            },
            {
                id: 'ngo-007',
                name: 'Animal Welfare Society',
                description: 'Protecting and caring for animals, rescue and rehabilitation programs',
                upiId: 'animalcare@upi',
                logo: 'https://via.placeholder.com/100?text=Animal+Care',
                category: 'other',
                website: 'https://animalwelfare.org'
            },
            {
                id: 'ngo-008',
                name: 'Rural Development Program',
                description: 'Sustainable development and infrastructure improvement in rural areas',
                upiId: 'ruraldev@upi',
                logo: 'https://via.placeholder.com/100?text=Rural+Dev',
                category: 'other',
                website: 'https://ruraldev.org'
            }
        ];

        // Clear existing NGOs
        await NGO.deleteMany({});
        console.log('✓ Cleared existing NGOs\n');

        // Insert new NGOs
        const result = await NGO.insertMany(ngos);
        console.log(`✓ Successfully inserted ${result.length} NGOs:\n`);

        result.forEach(ngo => {
            console.log(`  • ${ngo.name} (${ngo.id})`);
            console.log(`    UPI: ${ngo.upiId}`);
            console.log(`    Category: ${ngo.category}\n`);
        });

        console.log('✅ Seeding completed successfully!\n');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error seeding database:', error.message);
        console.error('\nMake sure MongoDB is running:');
        console.error('  1. Check MongoDB service is running');
        console.error('  2. Or set MONGODB_URI for MongoDB Atlas');
        process.exit(1);
    }
};

seedNGOs();
