# Round-Up Donations

Round-Up Donations is a **Chrome extension that enables micro-donations to local NGOs** by rounding up ecommerce purchases.

When users checkout on supported platforms like **Amazon, Flipkart, or Myntra**, the extension calculates the difference to the nearest multiple and allows users to donate the spare change to NGOs in their city.

This creates a **frictionless donation experience**, allowing people to contribute to social causes without changing their shopping behavior.

---

# Screenshots

![UI](https://github.com/user-attachments/assets/bc51a5f2-3f3c-4210-ad74-290fcec82039)

![Donation Setting](https://github.com/user-attachments/assets/4075148c-aafc-4af4-8cc9-b7c712f47be9)

![NGO Selection](https://github.com/user-attachments/assets/0469e535-3747-400f-8441-1e6c81ae649b)

---

# Key Features

## Automatic Checkout Detection

Detects cart totals directly on supported ecommerce websites including:

- Amazon.in  
- Flipkart.com  
- Myntra.com  

The extension automatically identifies checkout totals and prepares the round-up donation.

---

## Smart Rounding Engine

Calculates the **round-up value to the nearest multiple (default: ₹5)**.

Example:

| Purchase Total | Rounded Total | Donation |
|---------------|--------------|----------|
| ₹497 | ₹500 | ₹3 |
| ₹242 | ₹245 | ₹3 |

---

## Local NGO Selection

Users can choose NGOs based on their **city or region**, enabling localized impact.

Currently supported locations:

- Nashik
- Pune
- Mumbai

---

## Secure Payments

Uses **Razorpay** to process donations securely via:

- UPI
- Credit / Debit cards
- Net banking

---

## Donation History

Users can track all past donations and export receipts.

---

## Privacy Focused

User authentication and data isolation handled using **Firebase Authentication**.

---

# System Architecture

The project consists of two main components.

```
Round-Up Donations
│
├── donation-backend
│   ├── Express API
│   ├── Firestore Database
│   └── Razorpay Integration
│
└── donation-extension
    ├── Chrome Extension (Manifest v3)
    ├── Checkout Detection Scripts
    └── Donation UI
```

---

# Tech Stack

## Backend

- Node.js  
- Express.js  
- Firebase Firestore  
- Firebase Admin SDK  
- Razorpay  
- Helmet  
- CORS  

---

## Chrome Extension

- Manifest Version 3  
- Firebase Authentication  
- JavaScript (Vanilla)  
- Custom Editorial / Luxury UI Design  

---

# Project Structure

```
.
├── donation-backend/
│   ├── routes/
│   ├── controllers/
│   ├── seed-ngos.js
│   └── server.js
│
├── donation-extension/
│   ├── popup/
│   ├── scripts/
│   ├── settings/
│   └── manifest.json
│
└── README.md
```

---

# Installation

## Backend Setup

Navigate to backend directory

```bash
cd donation-backend
```

Install dependencies

```bash
npm install
```

Create `.env` file

```
PORT=5000
NODE_ENV=development
BASE_URL=http://localhost:5000

RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret
```

Add Firebase service account file:

```
serviceAccountKey.json
```

Seed NGO data

```bash
node seed-ngos.js
```

Start the server

```bash
npm start
```

For development with auto reload

```bash
npm run dev
```

---

# Extension Setup

Navigate to extension directory

```bash
cd donation-extension
```

Update Firebase configuration inside:

```
config.js
```

Load the extension in Chrome:

1. Open

```
chrome://extensions
```

2. Enable **Developer Mode**

3. Click **Load Unpacked**

4. Select the `donation-extension` folder

---

# Production API

The extension is configured to communicate with the deployed backend:

```
https://roundup-donation.onrender.com/api
```

For local development update:

```
popup.js
settings.js
```

Change API base URL to

```
http://localhost:5000/api
```

---

# Authentication Notes

## Brave Browser Users

Enable Google login support in:

```
brave://settings/extensions
```

Enable:

```
Allow Google login for extensions
```

---

## Google Account Switching

The extension uses a **Web OAuth Client ID** instead of a Chrome Extension OAuth client to **force account selection every login**.

---

# Local Development Tips

- Use **ngrok** if you need to expose your local server for HTTPS checkout testing.
- Refresh the extension after changes in:
  - `manifest.json`
  - background scripts

Refresh from

```
chrome://extensions
```

---

# Deployment

## Backend

Host the backend on services like:

- Render
- Railway
- Google Cloud Run
- AWS

Ensure environment variables are configured.

---


# Deployment Notes

Ensure the backend `.env` includes:

```
CORS_ORIGINS=<chrome-extension-id>
```

Update:

```
BASE_URL
```

to the production domain for Razorpay callback handling.

---

# Security

Use **Firebase Security Rules** to restrict Firestore access to authenticated users only.

---

# License

MIT License
