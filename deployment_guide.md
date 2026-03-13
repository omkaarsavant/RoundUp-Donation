# Deployment and Publishing Guide

This guide provides steps to host your backend online for free and publish your extension to the Chrome Web Store.

## 1. Hosting the Backend (Free)

For a Node.js Express backend, **Render** is recommended for its simplicity and reliable free tier.

### Prerequisites
- A GitHub account.
- Your `donation-backend` code pushed to a GitHub repository.

### Steps on Render.com
1. Create a free account on [Render](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Select the repository containing your project.
5. Configure the Web Service:
    - **Name**: Choose a name (e.g., `roundup-donation-api`).
    - **Root Directory**: `donation-backend` (since your repo has it as a subfolder).
    - **Runtime**: `Node`.
    - **Build Command**: `npm install`.
    - **Start Command**: `npm start`.
    - **Instance Type**: `Free`.
6. Click **Advanced** and add **Environment Variables**:
    - `PORT`: `5000` (or leave it to Render's default).
    - `RAZORPAY_KEY_ID`: `rzp_test_...` (from your dashboard).
    - `RAZORPAY_KEY_SECRET`: `...` (from your dashboard).
    - `NODE_ENV`: `production`.
    - `BASE_URL`: The URL Render provides you (e.g., `https://roundup-donation-api.onrender.com`).
7. **Firebase Credentials**: 
    - You can either commit your `serviceAccountKey.json` (not recommended for public repos) OR:
    - Set environment variables `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` in Render. Your `db.js` is already coded to pick these up.
8. Deploy. Render will provide you with a public URL.

### Update the Extension
1. Update `API_BASE_URL` in `donation-extension/popup.js` and `donation-extension/settings.js` to your new Render URL (ending in `/api`).

## 2. Publishing the Chrome Extension

Publishing requires a one-time $5 fee to Google.

### Step 1: Prepare the Assets
1. **Icons**: You already have `icons/logo.png`.
2. **Screenshots**: Take at least 2 screenshots (1280x800 or 640x400) of the popup and settings page.
3. **Zip the folder**: Compress the `donation-extension` folder into a `.zip` file.

### Step 2: Chrome Web Store Dashboard
1. Go to the [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole).
2. Sign in and pay the $5 registration fee if you haven't yet.
3. Click **New Item** and upload your `.zip` file.

### Step 3: Complete Store Listing
1. **Description**: Use the one from your `README.md`.
2. **Category**: `Productivity` or `Shopping`.
3. **Privacy Policy**: You MUST host a simple privacy policy URL. You can use a public Google Doc or GitHub Gist for this.
4. **Permissions Justification**: Chrome will ask why you need `scripting` and `activeTab`. 
    - Answer: "To detect cart totals on supported ecommerce websites to calculate rounding donations."

### Step 4: OAuth Verification & Account Selection
- **Crucial**: To make the "Account Selection" screen appear every time, you MUST use a **Web application** type Client ID in the Google Cloud Console (not "Chrome Extension").
- **Authorized Redirect URIs**: Add your extension's redirect URL: `https://<YOUR_EXTENSION_ID>.chromiumapp.org/`.
- **Brave Support**: If testing on Brave, users must enable **"Allow Google login for extensions"** in Brave settings.
- Ensure the "Authorized Domains" in the OAuth Consent Screen includes `onrender.com`.

### Step 5: Submit for Review
- Click **Submit for Review**. It typically takes 24–72 hours for Google to approve.

## 2. Free Alternatives for Publishing

If you want to avoid the $5 Chrome Web Store fee, here are your best free options:

### A. Microsoft Edge Add-ons (Totally Free)
Microsoft Edge uses the same engine as Chrome (Chromium), so your extension will work perfectly there.
- **Cost**: $0 (Free).
- **Store**: [Microsoft Edge Partner Center](https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview).
- **Process**: Very similar to Chrome. You upload the same `.zip` file, and once approved, Chrome users can also install it if they allow "extensions from other stores" in their settings.

### B. Self-Hosting via GitHub Releases (Totally Free)
You can distribute the extension directly to your users without any store.
- **Cost**: $0 (Free).
- **Process**:
    1. Create a "Release" on your GitHub repository.
    2. Upload the `donation-extension.zip` file.
    3. Users download the zip, extract it, and use **"Load unpacked"** in Developer Mode to install it.
- **Pros**: Instant distribution, no review process.
- **Cons**: Users must manually update and have Developer Mode enabled.

### C. Firefox Add-ons (Totally Free)
Firefox is also free to publish to, but since it doesn't use Chromium, you might need minor manifest changes (mostly renaming `action` to `browser_action` depending on the version, though Firefox now supports Manifest V3).
- **Store**: [Firefox Add-on Developer Hub](https://addons.mozilla.org/en-US/developers/).

## 3. Important Reminders
- **Render Cold Starts**: On the free tier, Render puts your backend to "sleep" after 15 minutes of inactivity. The first request might take 30 seconds to wake it up.
- **HTTPS**: Both Render and the Chrome Web Store require HTTPS, which Render provides automatically.
- **CORS**: Once your extension is published, you will get a permanent Extension ID. Update the `CORS_ORIGINS` in your backend `.env` (or Render dashboard) to only allow that ID.
