# Round-Up Donations

Round-Up Donations is a Chrome extension that helps users contribute to local NGOs by rounding up their purchases on popular ecommerce platforms like Amazon, Flipkart, and Myntra. The project consists of a dedicated Node.js backend for managing donations and a frontend extension for detecting totals and processing payments.

## Features

- Automatic Checkout Detection: Detects cart totals on Amazon.in, Flipkart.com, and Myntra.com.
- Smart Rounding: Automatically calculates the round-up amount to the nearest multiple (defaults to 5).
- Local NGO Selection: Users can select NGOs based on their location (e.g., Nashik, Pune, Mumbai).
- Secure Payments: Integration with Razorpay for secure UPI and card payments.
- Donation History: Users can track their past contributions and export receipts.
- Privacy Focused: Uses Firebase Auth for secure login and data isolation.

## Tech Stack

### Backend
- Runtime: Node.js with Express
- Database: Google Cloud Firestore (Firebase)
- Authentication: Firebase Admin SDK
- Payment Gateway: Razorpay
- Security: Helmet, CORS

### Extension
- Manifest Version: 3
- Authentication: Firebase Authentication (Google and Email)
- Language: JavaScript (Vanilla)
- Styling: Custom Luxury / Editorial design system

## Project Structure

- donation-backend/: Node.js server and API endpoints.
- donation-extension/: Chrome extension source files and assets.

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   cd donation-backend

2. Install dependencies:
   npm install

3. Configure Environment Variables:
   Create a .env file in the donation-backend directory based on .env.example:
   
   PORT=5000
   NODE_ENV=development
   BASE_URL=http://localhost:5000
   RAZORPAY_KEY_ID=your_razorpay_key
   RAZORPAY_KEY_SECRET=your_razorpay_secret

4. Firebase Configuration:
   Place your Firebase service account key file in the donation-backend directory and name it serviceAccountKey.json. This file is required for Firestore and Authentication operations.

5. Seed NGO Data:
   Populate the database with initial NGO information:
   node seed-ngos.js

6. Start the server:
   npm start

### Extension Setup

1. Navigate to the extension directory:
   `cd donation-extension`

2. Configure Firebase:
   Update `donation-extension/config.js` with your Firebase Project configuration from the console.

3. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right.
   - Click "Load unpacked" and select the `donation-extension/` directory.

4. **Production API URL**:
   The extension is pre-configured to communicate with the production backend at:
   `https://roundup-donation.onrender.com/api`
   If you are developing locally, change the `API_BASE_URL` in `popup.js` and `settings.js` back to `http://localhost:5000/api`.

5. **Authentication & Brave Browser**:
   - **Brave Users**: You must enable **"Allow Google login for extensions"** in `brave://settings/extensions` for Google Sign-In to work.
   - **Account Switching**: The extension uses a **Web Application OAuth Client ID** (not Chrome Extension type) to force the Google Account Selection screen every time you sign in. 

## Local Development

- Use npm run dev in the backend directory to start the server with nodemon for automatic restarts.
- Use ngrok or a similar tool if you need to expose the local server for testing checkout flows on HTTPS sites.
- Refresh the extension in chrome://extensions/ after making changes to the manifest or background scripts.

## Deployment

For instructions on how to host the backend for free and publish the extension to the Chrome Web Store, please refer to the [Deployment Guide](deployment_guide.md).

## Deployment Notes

- Ensure CORS_ORIGINS in the backend .env includes the official ID of your chrome extension once published.
- Update BASE_URL to your production domain for Razorpay callback redirects.
- Use Firebase security rules to restrict Firestore access to authenticated users only.
