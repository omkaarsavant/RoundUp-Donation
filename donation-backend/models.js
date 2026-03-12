// MongoDB Schemas and Models

const mongoose = require('mongoose');

// NGO Schema
const ngoSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    upiId: {
        type: String,
        required: true
    },
    logo: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['education', 'health', 'environment', 'poverty', 'disaster', 'other'],
        default: 'other'
    },
    website: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// User Schema
const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String
    },
    selectedNGO: {
        type: String,
        ref: 'NGO'
    },
    roundingRule: {
        type: String,
        enum: ['5', '10', '100'],
        default: '5'
    },
    totalDonated: {
        type: Number,
        default: 0
    },
    donationCount: {
        type: Number,
        default: 0
    },
    extensionEnabled: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    }
});

// Donation Schema
const donationSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: String,
        ref: 'User'
    },
    ngoId: {
        type: String,
        required: true
    },
    originalAmount: {
        type: Number,
        required: true
    },
    roundedAmount: {
        type: Number,
        required: true
    },
    donationAmount: {
        type: Number,
        required: true
    },
    website: {
        type: String,
        enum: ['amazon.in', 'flipkart.com', 'myntra.com'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    upiTransactionId: String,
    timestamp: {
        type: Date,
        default: Date.now
    },
    notes: String
});

// Transaction Log Schema (for audit trail)
const transactionLogSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true
    },
    userId: String,
    ngoId: String,
    donationAmount: Number,
    action: {
        type: String,
        enum: ['initiated', 'completed', 'failed', 'refunded'],
        required: true
    },
    details: mongoose.Schema.Types.Mixed,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Models
const NGO = mongoose.model('NGO', ngoSchema);
const User = mongoose.model('User', userSchema);
const Donation = mongoose.model('Donation', donationSchema);
const TransactionLog = mongoose.model('TransactionLog', transactionLogSchema);

module.exports = {
    NGO,
    User,
    Donation,
    TransactionLog
};
