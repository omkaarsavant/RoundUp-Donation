#!/bin/bash
# Start Development Server with Monitoring
# Run: npm run dev

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Round-Up Donations Backend${NC}\n"

# Check if Node modules are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Check MongoDB connection
echo -e "${BLUE}✓ Checking MongoDB connection...${NC}"
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/donation-db')
    .then(() => console.log('✓ MongoDB connected'))
    .catch(err => console.log('⚠ MongoDB not available (optional)', err.message));
" 2>/dev/null || echo "⚠️  MongoDB check skipped"

echo ""
echo -e "${GREEN}✓ Server starting...${NC}"
echo -e "${BLUE}📍 Server URL: http://localhost:5000${NC}"
echo -e "${BLUE}📍 Health check: http://localhost:5000/health${NC}"
echo -e "${BLUE}📍 API Docs: http://localhost:5000/api${NC}\n"

# Start with nodemon for auto-restart
npx nodemon server.js
