// Main Express Server

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import database and models
const connectDB = require('./db');
const { NGO, User, Donation, TransactionLog } = require('./models');

// Import routes
const ngoRoutes = require('./routes/ngo');
const donationRoutes = require('./routes/donations');
const userRoutes = require('./routes/user');

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for easier development/testing
    crossOriginEmbedderPolicy: false,
    frameguard: false // Disable X-Frame-Options
}));
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5000',
        'chrome-extension://*'
    ],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging & Private Network Access support
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    
    // Support Chrome's Private Network Access preflights
    if (req.headers['access-control-request-private-network']) {
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    
    // For non-options requests, still allow private network access
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// Health check & Root
app.get('/', (req, res) => {
    res.send(`<h1>🎁 RoundUp Backend Online</h1><p>Health check at <a href="/health">/health</a></p>`);
});

app.get('/health', (req, res) => {
    res.json({ status: 'Server is running', timestamp: new Date() });
});

// API Routes
app.use('/api/ngos', ngoRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/users', userRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// Start server
const startServer = async () => {
    // Connect to database
    const dbConnected = await connectDB();

    if (!dbConnected) {
        console.log('\n⚠️  Continuing without database. Features requiring DB will fail.');
        console.log('⚠️  Please set up MongoDB to use all features.\n');
    }

    app.listen(PORT, () => {
        console.log(`\n🚀 Server running at http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`📝 API Docs available in README.md\n`);
    });
};

// Start the server
startServer();

module.exports = app;
