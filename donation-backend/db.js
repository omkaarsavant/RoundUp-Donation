// MongoDB Connection

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/donation-db';
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✓ MongoDB connected successfully');
        return true;
    } catch (error) {
        console.error('✗ MongoDB connection failed:', error.message);
        console.log('\nTo run MongoDB locally:');
        console.log('  1. Install MongoDB: https://www.mongodb.com/try/download/community');
        console.log('  2. Start mongod service');
        console.log('  3. Or use MongoDB Atlas: https://www.mongodb.com/cloud/atlas');
        return false;
    }
};

module.exports = connectDB;
